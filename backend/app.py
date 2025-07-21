from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import numpy_financial as npf
import pdfplumber
from pdf2image import convert_from_bytes
import pytesseract
import re
import os
from io import BytesIO

app = Flask(__name__)
CORS(app)

# Mock GrokClient for market benchmarking
class GrokClient:
    def __init__(self, api_key):
        self.api_key = api_key
    
    def generate(self, prompt):
        try:
            return {
                "comps": [
                    {"address": "123 Main St, Austin, TX 78701", "rent_psf": 25.0, "cam_psf": 5.0, "taxes_psf": 2.0},
                    {"address": "456 Oak Ave, Austin, TX 78702", "rent_psf": 28.0, "cam_psf": 4.5, "taxes_psf": 1.8},
                    {"address": "789 Pine Rd, Austin, TX 78703", "rent_psf": 30.0, "cam_psf": 5.5, "taxes_psf": 2.2}
                ],
                "market_benchmarks": {
                    "avg_rent_psf": 28.75,
                    "avg_cam_psf": 5.0,
                    "avg_taxes_psf": 2.0
                },
                "insights": "Market shows stable rents.",
                "warnings": "",
                "is_valid": True
            }
        except Exception as e:
            raise Exception(f"Mock API error: {str(e)}")

# PDF extraction function
def extract_pdf_text(file_bytes):
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            text = "".join(page.extract_text() or "" for page in pdf.pages)
        
        if not text.strip():
            images = convert_from_bytes(file_bytes)
            text = "".join(pytesseract.image_to_string(img) for img in images)
        
        return text
    except Exception as e:
        return str(e)

# Enhanced PDF parsing
def parse_costar_data(text):
    data = {}
    
    # CoStar-specific patterns
    rent_match = re.search(r"\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|/square\s+foot|/sf/yr|/yr|psf|per\s+sf(?:/yr)?)", text, re.IGNORECASE)
    if rent_match:
        data["rent"] = min(float(rent_match.group(1)), 100.0)
    
    cam_match = re.search(r"(?:CAM|common\s+area\s+maintenance)\s*[:=]?\s*\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf)", text, re.IGNORECASE)
    if cam_match:
        data["cam"] = min(float(cam_match.group(1)), 50.0)
    
    tax_match = re.search(r"(?:tax|taxes)\s*[:=]?\s*\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf)", text, re.IGNORECASE)
    if tax_match:
        data["taxes"] = min(float(tax_match.group(1)), 50.0)
    
    sqft_match = re.search(r"(\d{1,3}(?:,\d{3})*|\d+)\s*(?:sqft|sf|square\s+feet)", text, re.IGNORECASE)
    if sqft_match:
        data["sqft"] = max(int(sqft_match.group(1).replace(",", "")), 1000)
    
    price_match = re.search(r"(?:purchase\s+price|price)\s*[:=]?\s*\$\s*(\d{1,3}(?:,\d{3})*)", text, re.IGNORECASE)
    if price_match:
        data["price"] = max(float(price_match.group(1).replace(",", "")), 100000)
    
    opex_match = re.search(r"(?:operating\s+expenses|opex)\s*[:=]?\s*\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf)", text, re.IGNORECASE)
    if opex_match:
        data["operatingExpenses"] = min(float(opex_match.group(1)), 50.0)
    
    type_match = re.search(r"\b(office|retail|industrial)\b", text, re.IGNORECASE)
    if type_match:
        data["propertyType"] = type_match.group(1).lower()
    
    return data

def validate_extracted_data(data, doc_type):
    """Validate extracted data with business logic"""
    validation = {"isValid": True, "warnings": [], "errors": []}
    
    # Rent validation
    if data.get("rent"):
        if data["rent"] < 5 or data["rent"] > 200:
            validation["warnings"].append(f"Rent ${data['rent']}/sf seems unusual (typical: $5-200/sf)")
    
    # Square footage validation
    if data.get("sqft"):
        if data["sqft"] < 500 or data["sqft"] > 1000000:
            validation["warnings"].append(f"Square footage {data['sqft']:,} seems unusual")
    
    # Purchase price validation
    if data.get("price") and data.get("sqft"):
        price_per_sqft = data["price"] / data["sqft"]
        if price_per_sqft < 50 or price_per_sqft > 2000:
            validation["warnings"].append(f"Price per sqft ${price_per_sqft:.0f} seems unusual (typical: $50-2000/sf)")
    
    # CAM validation
    if data.get("cam") and data["cam"] > 50:
        validation["warnings"].append(f"CAM charges ${data['cam']}/sf seem high (typical: $2-15/sf)")
    
    # Cross-validation
    if doc_type == 'costar' and not data.get("rent") and not data.get("sqft"):
        validation["errors"].append("No rental or size data found in CoStar report")
    
    if doc_type == 'title' and not data.get("price"):
        validation["errors"].append("No sale price found in title report")
    
    validation["isValid"] = len(validation["errors"]) == 0
    return validation

def parse_title_data(text):
    data = {}
    fullText = text.lower()
    
    # Title report patterns
    price_patterns = [
        r"(?:sale|purchase|consideration)\s*[:=]?\s*\$\s*(\d{1,3}(?:,\d{3})*)",
        r"(?:deed|transfer)[^$]*\$(\d{1,3}(?:,\d{3})*)",
        r"consideration\s*[:=]?\s*\$\s*(\d{1,3}(?:,\d{3})*)"
    ]
    
    for pattern in price_patterns:
        match = re.search(pattern, fullText, re.IGNORECASE)
        if match:
            data["price"] = max(float(match.group(1).replace(",", "")), 100000)
            break
    
    sqft_match = re.search(r"(\d{1,3}(?:,\d{3})*|\d+)\s*(?:sqft|sf|square\s+feet)", fullText, re.IGNORECASE)
    if sqft_match:
        data["sqft"] = max(int(sqft_match.group(1).replace(",", "")), 1000)
    
    tax_match = re.search(r"(?:property tax|annual tax|real estate tax)\s*[:=]?\s*\$\s*(\d+\.?\d*)", fullText, re.IGNORECASE)
    if tax_match:
        data["taxes"] = min(float(tax_match.group(1)), 50.0)
    
    return data

def detect_document_type(text):
    lowerText = text.lower()
    
    title_indicators = ['title report', 'preliminary report', 'title insurance', 'deed', 'easement']
    costar_indicators = ['costar', 'lease', 'rent', 'tenant', 'psf', 'rsf', 'cam']
    
    title_score = sum(1 for indicator in title_indicators if indicator in lowerText)
    costar_score = sum(1 for indicator in costar_indicators if indicator in lowerText)
    
    if title_score > costar_score and title_score > 2:
        return 'title'
    elif costar_score > title_score and costar_score > 2:
        return 'costar'
    return 'unknown'

# Financial calculation functions
def calculateMonthlyPayment(loan_amount, monthly_rate, total_months):
    if monthly_rate == 0:
        return loan_amount / total_months
    return loan_amount * (monthly_rate * (1 + monthly_rate) ** total_months) / ((1 + monthly_rate) ** total_months - 1)

def calculateAmortizationSchedule(loan_amount, annual_rate, loan_term_years, interest_only_years=0):
    monthly_rate = annual_rate / 100 / 12
    total_months = loan_term_years * 12
    io_months = interest_only_years * 12
    schedule = []
    
    balance = loan_amount
    
    for month in range(1, total_months + 1):
        interest_payment = balance * monthly_rate
        
        if month <= io_months:
            # Interest only period
            monthly_payment = interest_payment
            principal_payment = 0
        else:
            # Amortizing period
            remaining_months = total_months - month + 1
            monthly_payment = calculateMonthlyPayment(balance, monthly_rate, remaining_months)
            principal_payment = monthly_payment - interest_payment
        
        balance -= principal_payment
        balance = max(0, balance)  # Prevent negative balance
        
        schedule.append({
            "month": month,
            "year": (month + 11) // 12,  # Convert to year
            "payment": monthly_payment,
            "principal": principal_payment,
            "interest": interest_payment,
            "balance": balance
        })
    
    return schedule

def calculateIRR(cash_flows):
    """Newton-Raphson method for IRR calculation"""
    rate = 0.1  # Initial guess
    tolerance = 0.00001
    max_iterations = 1000
    
    for i in range(max_iterations):
        npv = 0
        dnpv = 0
        
        for j, cf in enumerate(cash_flows):
            period = j
            npv += cf / (1 + rate) ** period
            dnpv += -period * cf / (1 + rate) ** (period + 1)
        
        if abs(npv) < tolerance:
            return rate * 100
        
        if dnpv == 0:
            break
            
        rate = rate - npv / dnpv
        
        if rate < -0.99:
            rate = -0.99
    
    return rate * 100

def analyze_scenario(purchase_price, monthly_expenses, rent_psf, square_feet, downpayment_pct, 
                    interest_rate, appreciation_pct, hold_period, loan_term, interest_only_years, 
                    cam_psf, taxes_psf):
    
    # Input validation
    purchase_price = max(purchase_price, 100000)
    monthly_expenses = max(monthly_expenses, 0)
    rent_psf = min(max(rent_psf, 0), 100)
    square_feet = max(square_feet, 1000)
    downpayment_pct = min(max(downpayment_pct, 0), 100)
    interest_rate = min(max(interest_rate, 0), 20)
    appreciation_pct = min(max(appreciation_pct, 0), 10)
    hold_period = min(max(hold_period, 1), 30)
    loan_term = min(max(loan_term, hold_period), 30)
    interest_only_years = min(max(interest_only_years, 0), loan_term)
    cam_psf = min(max(cam_psf, 0), 50)
    taxes_psf = min(max(taxes_psf, 0), 50)

    # Basic calculations
    downpayment_amount = purchase_price * (downpayment_pct / 100)
    loan_amount = purchase_price - downpayment_amount
    annual_rent = rent_psf * square_feet
    operating_expenses = monthly_expenses * 12 + cam_psf * square_feet + taxes_psf * square_feet
    noi = annual_rent - operating_expenses

    # Generate amortization schedule
    amort_schedule = calculateAmortizationSchedule(loan_amount, interest_rate, loan_term, interest_only_years)
    
    # Calculate monthly and annual metrics
    monthly_noi = noi / 12
    annual_cash_flows = []
    total_principal_paydown = 0
    
    # Build cash flow projections
    for year in range(hold_period):
        yearly_debt_service = 0
        yearly_principal = 0
        
        for month in range(1, 13):
            schedule_index = year * 12 + month - 1
            if schedule_index < len(amort_schedule):
                yearly_debt_service += amort_schedule[schedule_index]["payment"]
                yearly_principal += amort_schedule[schedule_index]["principal"]
        
        # Apply rent growth (2.5% annually)
        current_year_rent = annual_rent * (1.025 ** year)
        current_year_noi = current_year_rent - operating_expenses
        yearly_net_cash_flow = current_year_noi - yearly_debt_service
        
        annual_cash_flows.append(yearly_net_cash_flow)
        total_principal_paydown += yearly_principal

    # Calculate sale proceeds
    future_value = purchase_price * (1 + appreciation_pct / 100) ** hold_period
    remaining_loan_balance = amort_schedule[min(hold_period * 12 - 1, len(amort_schedule) - 1)]["balance"] if amort_schedule else 0
    sale_proceeds = future_value - remaining_loan_balance

    # Build IRR cash flow array
    irr_cash_flows = [-downpayment_amount] + annual_cash_flows
    if irr_cash_flows:
        irr_cash_flows[-1] += sale_proceeds

    # Calculate metrics
    cap_rate = (noi / purchase_price) * 100
    average_annual_cash_flow = sum(annual_cash_flows) / len(annual_cash_flows) if annual_cash_flows else 0
    coc_return = (average_annual_cash_flow / downpayment_amount) * 100 if downpayment_amount > 0 else 0
    irr = calculateIRR(irr_cash_flows)
    total_return = sum(annual_cash_flows) + (future_value - purchase_price) + total_principal_paydown
    equity_multiple = (downpayment_amount + total_return) / downpayment_amount if downpayment_amount > 0 else 0

    # Debt service coverage ratio
    first_year_debt_service = sum(month["payment"] for month in amort_schedule[:12]) if amort_schedule else 0
    dscr = noi / first_year_debt_service if first_year_debt_service > 0 else 0

    return {
        "capRate": cap_rate,
        "cashFlow": average_annual_cash_flow,
        "cocReturn": coc_return,
        "irr": irr,
        "futureValue": future_value,
        "equityGain": future_value - purchase_price,
        "totalReturn": total_return,
        "equityMultiple": equity_multiple,
        "dscr": dscr,
        "principalPaydown": total_principal_paydown,
        "saleProceeds": sale_proceeds,
        "amortSchedule": amort_schedule[:hold_period * 12],
        "annualCashFlows": annual_cash_flows,
        "irrCashFlows": irr_cash_flows,
        "noi": noi
    }

# API Routes
@app.route('/parse-pdf', methods=['POST'])
def parse_pdf():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({"error": "File must be a PDF"}), 400
        
        # Extract text from PDF
        file_bytes = file.read()
        text = extract_pdf_text(file_bytes)
        
        if len(text.strip()) < 50:
            return jsonify({"error": "Could not extract sufficient text from PDF. Document may be scanned or corrupted."}), 400
        
        # Detect document type
        doc_type = detect_document_type(text)
        
        # Parse based on document type
        if doc_type == 'title':
            extracted_data = parse_title_data(text)
        elif doc_type == 'costar':
            extracted_data = parse_costar_data(text)
        else:
            # Try both parsers and use the one with more results
            title_data = parse_title_data(text)
            costar_data = parse_costar_data(text)
            
            if len(title_data) > len(costar_data):
                extracted_data = title_data
                doc_type = 'title'
            else:
                extracted_data = costar_data
                doc_type = 'costar'
        
        # Validate extracted data
        validation = validate_extracted_data(extracted_data, doc_type)
        
        # Add metadata
        extracted_data['documentType'] = doc_type
        extracted_data['textLength'] = len(text)
        extracted_data['validation'] = validation
        
        # Include raw text sample for debugging (first 500 chars)
        extracted_data['textSample'] = text[:500] + "..." if len(text) > 500 else text
        
        return jsonify(extracted_data)
    
    except Exception as e:
        return jsonify({"error": f"PDF processing failed: {str(e)}"}), 500

@app.route('/calculate-metrics', methods=['POST'])
def calculate_metrics():
    try:
        data = request.get_json()
        
        # Extract parameters
        general = data.get('general', {})
        scenarios = data.get('scenarios', {})
        
        results = {}
        
        for scenario_name, scenario_params in scenarios.items():
            result = analyze_scenario(
                purchase_price=general.get('purchasePrice', 1000000),
                monthly_expenses=general.get('monthlyOperatingExpenses', 0),
                rent_psf=scenario_params.get('rent', 25),
                square_feet=general.get('sqft', 10000),
                downpayment_pct=scenario_params.get('downPayment', 25),
                interest_rate=scenario_params.get('interestRate', 5),
                appreciation_pct=scenario_params.get('appreciation', 3),
                hold_period=general.get('holdPeriod', 10),
                loan_term=general.get('loanTerm', 25),
                interest_only_years=general.get('interestOnlyPeriod', 2),
                cam_psf=general.get('cam', 5),
                taxes_psf=general.get('taxes', 2)
            )
            results[scenario_name] = result
        
        return jsonify(results)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/fetch-comps', methods=['POST'])
def fetch_comps():
    try:
        data = request.get_json()
        address = data.get('address', '')
        property_type = data.get('propertyType', 'Office')
        
        if not address:
            return jsonify({"error": "Address is required"}), 400
        
        client = GrokClient(api_key=os.environ.get("GROK_API_KEY", ""))
        result = client.generate(f"Search for {property_type} comps near {address}")
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "CRE API is running"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
