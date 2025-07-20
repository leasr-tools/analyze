import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
from plotly.subplots import make_subplots
import numpy_financial as npf
import pdfplumber
from pdf2image import convert_from_bytes
import pytesseract
import re
import os
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart

# Mock GrokClient for testing (replace with actual xai-grok when available)
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

# Streamlit page config
st.set_page_config(layout="wide", page_title="CRE Deal Analyzer")
st.markdown("""
<style>
.stApp { background: linear-gradient(to bottom right, #f3f4f6, #e5e7eb); color: #1f2937; font-family: Inter; }
h1, h2, h3 { color: #b45309; }
.stButton>button { background-color: #b45309; color: white; border-radius: 8px; }
.stTextInput>div>input { background-color: #ffffff; color: #1f2937; border-radius: 8px; border: 1px solid #d1d5db; }
.stNumberInput>div>input { background-color: #ffffff; color: #1f2937; border-radius: 8px; border: 1px solid #d1d5db; }
.stSelectbox>div>div>select { background-color: #ffffff; color: #1f2937; border-radius: 8px; border: 1px solid #d1d5db; }
</style>
""", unsafe_allow_html=True)

# Grok 3 comps function with market benchmarks
@st.cache_data
def fetch_grok_comps(address, property_type="Office"):
    if not address or not re.match(r"^\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}$", address):
        return None, None, "", "Invalid or missing address for AI comps. Please enter a valid U.S. address (e.g., 123 Main St, City, ST 12345)."
    try:
        client = GrokClient(api_key=os.environ.get("GROK_API_KEY", ""))
        prompt = f"""
        Search for recent {property_type} lease comps near {address}.
        Extract: address, rent per square foot, CAM per SF, taxes per SF.
        Include market benchmarks: avg rent per SF, avg CAM per SF, avg taxes per SF.
        Sources: LoopNet, Crexi, CoStar, X posts.
        Return as JSON with at least 3 comps.
        If fewer than 3 comps, generate synthetic comps based on market trends for {property_type} in the region.
        Output: {{'comps': [{{\"address\": str, \"rent_psf\": float, \"cam_psf\": float, \"taxes_psf\": float}}], 'market_benchmarks': {{'avg_rent_psf': float, 'avg_cam_psf': float, 'avg_taxes_psf': float}}, 'insights': str, 'warnings': str}}
        """
        result = client.generate(prompt)
        comps = pd.DataFrame(result.get("comps", []))
        benchmarks = result.get("market_benchmarks", {})
        if not comps.empty:
            return comps[["address", "rent_psf", "cam_psf", "taxes_psf"]], benchmarks, result.get("insights", ""), result.get("warnings", "")
        return None, None, "", "No comps found"
    except Exception as e:
        return None, None, "", f"API error: {str(e)}"

# PDF extraction function
@st.cache_data
def extract_pdf_data(file):
    try:
        with pdfplumber.open(file) as pdf:
            text = "".join(page.extract_text() or "" for page in pdf.pages)
        if not text.strip():
            images = convert_from_bytes(file.read())
            text = "".join(pytesseract.image_to_string(img) for img in images)
        file.seek(0)
        return text
    except Exception as e:
        return str(e)

# Enhanced PDF parsing
def parse_pdf_data(text):
    data = {"address": "", "property_type": "Office", "square_feet": 10000, "rent_psf": 28.0, "cam_psf": 5.0, "taxes_psf": 2.0}
    rent_match = re.search(r"\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|/square\s+foot|/sf/yr|/yr|psf|per\s+sf(?:/yr)?)", text, re.IGNORECASE)
    if rent_match:
        data["rent_psf"] = float(rent_match.group(1))
    address_match = re.search(r"(\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})", text, re.IGNORECASE)
    if address_match:
        data["address"] = address_match.group(1)
    sqft_match = re.search(r"(\d{1,3}(?:,\d{3})*|\d+)\s*(?:sqft|sf|square\s+feet)", text, re.IGNORECASE)
    if sqft_match:
        data["square_feet"] = int(sqft_match.group(1).replace(",", ""))
    type_match = re.search(r"\b(office|retail|industrial)\b", text, re.IGNORECASE)
    if type_match:
        data["property_type"] = type_match.group(1).capitalize()
    cam_match = re.search(r"(?:CAM|common\s+area\s+maintenance)\s*[:=]?\s*\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf)", text, re.IGNORECASE)
    if cam_match:
        data["cam_psf"] = float(cam_match.group(1))
    taxes_match = re.search(r"(?:tax|taxes)\s*[:=]?\s*\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf)", text, re.IGNORECASE)
    if taxes_match:
        data["taxes_psf"] = float(taxes_match.group(1))
    return data

# Financial calculator
def analyze_deal(purchase_price, rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term, cam_psf, taxes_psf):
    rent = rent_psf * square_feet / 12
    total_expenses = expenses + (cam_psf + taxes_psf) * square_feet / 12
    noi = (rent - total_expenses) * 12
    cap_rate = noi / purchase_price
    monthly_payment = -npf.pmt(interest_rate / 12, loan_term * 12, loan_amount)
    cash_flow = noi / 12 - monthly_payment
    coc_return = (cash_flow * 12) / (purchase_price - loan_amount)
    cash_flows = [-purchase_price + loan_amount] + [cash_flow * 12 for _ in range(loan_term)]
    irr = npf.irr(cash_flows) if cash_flows else 0
    return {
        "Cap Rate": cap_rate,
        "Cash Flow": cash_flow,
        "CoC Return": coc_return,
        "IRR": irr,
        "NOI": noi
    }

# PDF report
def generate_pdf_report(scenarios, comps, benchmarks, insights):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, 750, "CRE Deal Analysis Report")
    y = 700
    c.setFont("Helvetica", 12)
    for name, result in scenarios.items():
        c.drawString(100, y, f"{name} Scenario")
        y -= 20
        c.drawString(120, y, f"Cap Rate: {result['Cap Rate']:.2%}")
        c.drawString(120, y-20, f"Cash Flow: ${result['Cash Flow']:,.0f}/month")
        c.drawString(120, y-40, f"NOI: ${result['NOI']:,.0f}/year")
        c.drawString(120, y-60, f"IRR: {result['IRR']:.2%}")
        y -= 80
    if comps is not None:
        c.drawString(100, y, "Lease Comps")
        y -= 20
        for _, row in comps.iterrows():
            c.drawString(120, y, f"{row['address']}: ${row['rent_psf']:.2f}/sqft")
            y -= 20
    if benchmarks:
        c.drawString(100, y, "Market Benchmarks")
        y -= 20
        c.drawString(120, y, f"Avg Rent: ${benchmarks['avg_rent_psf']:.2f}/sqft")
        c.drawString(120, y-20, f"Avg CAM: ${benchmarks['avg_cam_psf']:.2f}/sqft")
        c.drawString(120, y-40, f"Avg Taxes: ${benchmarks['avg_taxes_psf']:.2f}/sqft")
        y -= 60
    c.drawString(100, y, "AI Insights")
    c.drawString(120, y-20, insights)
    d = Drawing(200, 100)
    bc = VerticalBarChart()
    bc.data = [[scenarios[s]["Cap Rate"] * 100 for s in ["Conservative", "Base", "Optimistic"]]]
    bc.categoryAxis.categoryNames = ["Conservative", "Base", "Optimistic"]
    d.add(bc)
    c.drawImage(d, 100, y-150)
    c.save()
    buffer.seek(0)
    return buffer

# Main app
st.title("CRE Deal Analyzer")

# Access code
access_code = st.text_input("Enter Access Code", type="password")
if access_code != "crebeta25":
    st.error("Invalid access code")
    st.stop()

# PDF upload
uploaded_file = st.file_uploader("Upload CoStar/Title Report (PDF)", type="pdf")
pdf_data = parse_pdf_data("")  # Default empty data
if uploaded_file:
    with st.spinner("Extracting PDF data..."):
        text = extract_pdf_data(uploaded_file)
        pdf_data = parse_pdf_data(text)
        st.success("PDF data extracted")
        if pdf_data.get("rent_psf"):
            st.write(f"Extracted Rent: ${pdf_data['rent_psf']:.2f}/sqft")
        if pdf_data.get("cam_psf"):
            st.write(f"Extracted CAM: ${pdf_data['cam_psf']:.2f}/sqft")
        if pdf_data.get("taxes_psf"):
            st.write(f"Extracted Taxes: ${pdf_data['taxes_psf']:.2f}/sqft")
        if pdf_data.get("address"):
            st.write(f"Extracted Address: {pdf_data['address']}")
        if pdf_data.get("square_feet"):
            st.write(f"Extracted Square Footage: {pdf_data['square_feet']:,} SF")
        if not any([pdf_data.get("rent_psf"), pdf_data.get("cam_psf"), pdf_data.get("taxes_psf")]):
            st.warning("No financial data found in PDF. Please enter manually.")

# Inputs in two-column layout
st.markdown("### Property Details")
col1, col2 = st.columns(2)
with col1:
    address = st.text_input("Property Address", value=pdf_data.get("address", ""), help="Enter a valid U.S. address (e.g., 123 Main St, City, ST 12345)")
    property_type_options = ["Office", "Retail", "Industrial"]
    default_index = property_type_options.index(pdf_data["property_type"]) if pdf_data.get("property_type") in property_type_options else 0
    property_type = st.selectbox("Property Type", property_type_options, index=default_index)
with col2:
    square_feet = st.number_input("Square Footage", min_value=1000, value=pdf_data.get("square_feet", 10000))
    use_ai_comps = st.checkbox("Use AI Lease Comps for Benchmarking", value=True)

st.markdown("### Financial Inputs")
col3, col4 = st.columns(2)
with col3:
    purchase_price = st.number_input("Purchase Price ($)", value=1000000)
    expenses = st.number_input("Monthly Expenses ($)", value=5000)
    rent_psf = st.number_input("Base Rent ($/sqft/year)", value=pdf_data.get("rent_psf", 28.0), key="base_rent")
with col4:
    loan_amount = st.number_input("Loan Amount ($)", value=800000)
    interest_rate = st.number_input("Interest Rate (%)", value=5.0) / 100
    loan_term = st.number_input("Loan Term (years)", value=20)
    cam_psf = st.number_input("CAM ($/sqft/year)", value=pdf_data.get("cam_psf", 5.0), key="cam_psf")
    taxes_psf = st.number_input("Taxes ($/sqft/year)", value=pdf_data.get("taxes_psf", 2.0), key="taxes_psf")

# Analyze deal
if st.button("Analyze Deal"):
    with st.spinner("Analyzing deal..."):
        comps, benchmarks, insights, warnings = None, None, "", ""
        if use_ai_comps and address:
            comps, benchmarks, insights, warnings = fetch_grok_comps(address, property_type)
        if comps is not None:
            st.subheader("Lease Comps")
            st.dataframe(comps)
            st.markdown(f"**AI Insights**: {insights}")
            if warnings:
                st.warning(warnings)
            conservative_rent_psf = rent_psf * 0.9
            base_rent_psf = rent_psf
            optimistic_rent_psf = rent_psf * 1.1
        else:
            st.warning("No AI comps found or invalid address. Using ±10% rent scenarios.")
            conservative_rent_psf = rent_psf * 0.9
            base_rent_psf = rent_psf
            optimistic_rent_psf = rent_psf * 1.1

        # Scenario analysis
        scenarios = {
            "Conservative": analyze_deal(purchase_price, conservative_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term, cam_psf, taxes_psf),
            "Base": analyze_deal(purchase_price, base_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term, cam_psf, taxes_psf),
            "Optimistic": analyze_deal(purchase_price, optimistic_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term, cam_psf, taxes_psf)
        }

        # Market benchmarking
        if benchmarks:
            st.subheader("Market Benchmarking")
            benchmark_data = [
                {"Metric": "Rent ($/sqft)", "Analyzer (Base)": base_rent_psf, "Market Avg": benchmarks["avg_rent_psf"], "Status": "Over" if base_rent_psf > benchmarks["avg_rent_psf"] else "Under" if base_rent_psf < benchmarks["avg_rent_psf"] else "Aligned"},
                {"Metric": "CAM ($/sqft)", "Analyzer (Base)": cam_psf, "Market Avg": benchmarks["avg_cam_psf"], "Status": "High" if cam_psf > benchmarks["avg_cam_psf"] else "Low" if cam_psf < benchmarks["avg_cam_psf"] else "Aligned"},
                {"Metric": "Taxes ($/sqft)", "Analyzer (Base)": taxes_psf, "Market Avg": benchmarks["avg_taxes_psf"], "Status": "High" if taxes_psf > benchmarks["avg_taxes_psf"] else "Low" if taxes_psf < benchmarks["avg_taxes_psf"] else "Aligned"}
            ]
            st.dataframe(pd.DataFrame(benchmark_data))

        # Three-column scenario summaries
        st.subheader("Scenario Analysis")
        cols = st.columns(3)
        for i, (name, result) in enumerate(scenarios.items()):
            with cols[i]:
                st.markdown(f"**{name} Scenario**")
                st.metric("Cap Rate", f"{result['Cap Rate']:.2%}")
                st.metric("Cash Flow", f"${result['Cash Flow']:,.0f}/month")
                st.metric("NOI", f"${result['NOI']:,.0f}/year")
                st.metric("IRR", f"{result['IRR']:.2%}")

        # Sensitivity analysis
        st.subheader("Sensitivity Analysis")
        sensitivity = []
        for rent_adj in [-0.1, 0, 0.1]:
            adjusted_rent = base_rent_psf * (1 + rent_adj)
            result = analyze_deal(purchase_price, adjusted_rent, square_feet, expenses, loan_amount, interest_rate, loan_term, cam_psf, taxes_psf)
            sensitivity.append({"Rent Change": f"{rent_adj:.0%}", "IRR": result["IRR"]})
        st.dataframe(pd.DataFrame(sensitivity))

        # Bar charts
        st.subheader("Financial Metrics")
        fig = make_subplots(rows=1, cols=3, subplot_titles=("Cap Rate", "Cash Flow", "NOI"))
        fig.add_bar(x=list(scenarios.keys()), y=[scenarios[s]["Cap Rate"] * 100 for s in scenarios], row=1, col=1)
        fig.add_bar(x=list(scenarios.keys()), y=[scenarios[s]["Cash Flow"] for s in scenarios], row=1, col=2)
        fig.add_bar(x=list(scenarios.keys()), y=[scenarios[s]["NOI"] for s in scenarios], row=1, col=3)
        fig.update_layout(showlegend=False, height=300)
        st.plotly_chart(fig, use_container_width=True)

        # PDF download
        st.download_button(
            label="Download PDF Report",
            data=generate_pdf_report(scenarios, comps, benchmarks, insights),
            file_name="cre_deal_report.pdf",
            mime="application/pdf"
        )

# User-contributed comps
with st.form("user_comps"):
    st.markdown("### Contribute Lease Comp")
    comp_address = st.text_input("Comp Address", help="Enter a valid U.S. address (e.g., 123 Main St, City, ST 12345)", key="comp_address")
    comp_rent_psf = st.number_input("Rent ($/sqft/year)", min_value=0.0, key="comp_rent_psf")
    comp_cam_psf = st.number_input("CAM ($/sqft/year)", min_value=0.0, value=5.0, key="comp_cam_psf")
    comp_taxes_psf = st.number_input("Taxes ($/sqft/year)", min_value=0.0, value=2.0, key="comp_taxes_psf")
    submit = st.form_submit_button("Submit Comp")
    if submit and comp_address:
        try:
            client = GrokClient(api_key=os.environ.get("GROK_API_KEY", ""))
            prompt = f"Validate lease comp: Address={comp_address}, Rent=${comp_rent_psf:.2f}/sqft, CAM=${comp_cam_psf:.2f}/sqft, Taxes=${comp_taxes_psf:.2f}/sqft"
            result = client.generate(prompt)
            if result.get("is_valid"):
                pd.DataFrame([{
                    "address": comp_address, "rent_psf": comp_rent_psf, 
                    "cam_psf": comp_cam_psf, "taxes_psf": comp_taxes_psf
                }]).to_csv("user_comps.csv", mode="a", index=False)
                st.success("Comp added!")
            else:
                st.error("Invalid comp data")
        except Exception as e:
            st.error(f"Failed to validate comp: {str(e)}")
