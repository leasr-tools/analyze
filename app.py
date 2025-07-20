import streamlit as st
import pandas as pd
import numpy as np
import numpy_financial as npf
import pdfplumber
from pdf2image import convert_from_bytes
import pytesseract
import re
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# ------------------ PDF FUNCTIONS ------------------
def extract_pdf_text(file):
    """Extract text from PDF or fallback to OCR."""
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

def parse_summary_data(text):
    """Parse key values from PDF text."""
    data = {
        "rent_psf": 28.0,
        "cam_psf": 5.0,
        "taxes_psf": 2.0,
        "square_feet": 10000
    }
    rent_match = re.search(r"\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf|/yr)", text, re.IGNORECASE)
    if rent_match:
        data["rent_psf"] = float(rent_match.group(1))
    cam_match = re.search(r"(?:CAM|common\s+area)\s*\$?\s*(\d+\.?\d*)", text, re.IGNORECASE)
    if cam_match:
        data["cam_psf"] = float(cam_match.group(1))
    tax_match = re.search(r"(?:Taxes|Property Taxes)\s*\$?\s*(\d+\.?\d*)", text, re.IGNORECASE)
    if tax_match:
        data["taxes_psf"] = float(tax_match.group(1))
    sqft_match = re.search(r"(\d{1,3}(?:,\d{3})*|\d+)\s*(?:sqft|sf|square\s+feet)", text, re.IGNORECASE)
    if sqft_match:
        data["square_feet"] = int(sqft_match.group(1).replace(",", ""))
    return data

# ------------------ FINANCIAL ENGINE ------------------
def amortization_schedule(loan_amount, annual_rate, term_years, interest_only_years=0):
    schedule = []
    monthly_rate = annual_rate / 12
    n_months = term_years * 12
    balance = loan_amount
    monthly_payment = 0 if interest_only_years > 0 else -npf.pmt(monthly_rate, n_months, loan_amount)

    for month in range(1, n_months + 1):
        if month <= interest_only_years * 12:
            interest = balance * monthly_rate
            principal = 0
            payment = interest
        else:
            if month == interest_only_years * 12 + 1:
                monthly_payment = -npf.pmt(monthly_rate, n_months - interest_only_years * 12, balance)
            interest = balance * monthly_rate
            principal = monthly_payment - interest
            payment = monthly_payment
            balance -= principal

        schedule.append({
            "Month": month,
            "Payment": payment,
            "Principal": principal,
            "Interest": interest,
            "Balance": balance
        })
    return pd.DataFrame(schedule)

def analyze_scenario(purchase_price, monthly_expenses, rent_psf, square_feet,
                     downpayment_pct, interest_rate, appreciation_pct,
                     hold_period, loan_term, interest_only_years, cam_psf, taxes_psf):
    downpayment = purchase_price * (downpayment_pct / 100)
    loan_amount = purchase_price - downpayment

    # Monthly rent & expenses
    monthly_rent = (rent_psf + cam_psf + taxes_psf) * square_feet / 12
    monthly_noi = monthly_rent - monthly_expenses

    # Amortization
    schedule = amortization_schedule(loan_amount, interest_rate / 100, loan_term, interest_only_years)
    total_principal_paid = schedule[schedule["Month"] <= hold_period * 12]["Principal"].sum()

    # Cash Flow
    total_interest_paid = schedule[schedule["Month"] <= hold_period * 12]["Interest"].sum()
    cash_flow = monthly_noi * 12 * hold_period - total_interest_paid

    # Property value in X years
    future_value = purchase_price * (1 + appreciation_pct / 100) ** hold_period
    equity_gain = future_value - loan_amount - downpayment

    # Cap rate, IRR, CoC
    cap_rate = (monthly_noi * 12) / purchase_price
    irr_cashflows = [-downpayment] + [monthly_noi * 12] * (hold_period - 1) + [monthly_noi * 12 + future_value]
    irr = npf.irr(irr_cashflows)
    coc_return = (monthly_noi * 12) / downpayment

    return {
        "Cap Rate": cap_rate,
        "Cash Flow": cash_flow,
        "CoC Return": coc_return,
        "IRR": irr,
        "Value": future_value,
        "Equity Gain": equity_gain,
        "Schedule": schedule
    }

def analyze_multi_scenarios(general, scenarios):
    results = {}
    for scenario, params in scenarios.items():
        results[scenario] = analyze_scenario(
            general["purchase_price"],
            general["monthly_expenses"],
            params["rent"],
            general["square_feet"],
            params["downpayment"],
            params["interest_rate"],
            params["appreciation"],
            general["hold_period"],
            general["loan_term"],
            general["interest_only_years"],
            general["cam_psf"],
            general["taxes_psf"]
        )
    return results

# ------------------ UI ------------------
st.title("CRE Deal Analyzer")

# Step 1: Upload PDF
uploaded_file = st.file_uploader("Upload CoStar/Title Report (Optional)", type="pdf")
pdf_data = {"rent_psf": 28.0, "cam_psf": 5.0, "taxes_psf": 2.0, "square_feet": 10000}
if uploaded_file:
    with st.spinner("Extracting PDF data..."):
        text = extract_pdf_text(uploaded_file)
        pdf_data = parse_summary_data(text)
    st.success("PDF data extracted!")

# Step 2: General Parameters
st.markdown("## Step 2: General Parameters")
col_gen1, col_gen2, col_gen3 = st.columns(3)
with col_gen1:
    purchase_price = st.number_input("Purchase Price ($)", value=1000000)
    monthly_expenses = st.number_input("Monthly Operating Expenses ($)", value=5000)
with col_gen2:
    hold_period = st.number_input("Hold Period (years)", min_value=1, max_value=30, value=5)
    interest_only_years = st.number_input("Interest-Only Period (years)", min_value=0, max_value=10, value=2)
with col_gen3:
    loan_term = st.number_input("Loan Term (years)", min_value=1, max_value=30, value=20)

# Step 3: Scenario Parameters
st.markdown("## Step 3: Scenario Parameters")
col_cons, col_base, col_opt = st.columns(3)
with col_cons:
    st.markdown("### Conservative")
    cons_rent = st.number_input("Rent ($/sqft/year)", value=pdf_data['rent_psf'] * 0.9, key="cons_rent")
    cons_down = st.number_input("Downpayment (%)", value=25.0, key="cons_down")
    cons_int = st.number_input("Interest Rate (%)", value=5.5, key="cons_int")
    cons_app = st.number_input("Appreciation (%)", value=2.0, key="cons_app")

with col_base:
    st.markdown("### Base")
    base_rent = st.number_input("Rent ($/sqft/year)", value=pdf_data['rent_psf'], key="base_rent")
    base_down = st.number_input("Downpayment (%)", value=20.0, key="base_down")
    base_int = st.number_input("Interest Rate (%)", value=5.0, key="base_int")
    base_app = st.number_input("Appreciation (%)", value=3.0, key="base_app")

with col_opt:
    st.markdown("### Optimistic")
    opt_rent = st.number_input("Rent ($/sqft/year)", value=pdf_data['rent_psf'] * 1.1, key="opt_rent")
    opt_down = st.number_input("Downpayment (%)", value=15.0, key="opt_down")
    opt_int = st.number_input("Interest Rate (%)", value=4.5, key="opt_int")
    opt_app = st.number_input("Appreciation (%)", value=4.0, key="opt_app")

# Run Analysis
if st.button("Analyze Deal"):
    general = {
        "purchase_price": purchase_price,
        "monthly_expenses": monthly_expenses,
        "hold_period": hold_period,
        "interest_only_years": interest_only_years,
        "loan_term": loan_term,
        "square_feet": pdf_data['square_feet'],
        "cam_psf": pdf_data['cam_psf'],
        "taxes_psf": pdf_data['taxes_psf']
    }
    scenarios = {
        "Conservative": {"rent": cons_rent, "downpayment": cons_down, "interest_rate": cons_int, "appreciation": cons_app},
        "Base": {"rent": base_rent, "downpayment": base_down, "interest_rate": base_int, "appreciation": base_app},
        "Optimistic": {"rent": opt_rent, "downpayment": opt_down, "interest_rate": opt_int, "appreciation": opt_app}
    }
    results = analyze_multi_scenarios(general, scenarios)

    # Results Table
    st.markdown("## Results")
    metrics = []
    for scenario, res in results.items():
        metrics.append({
            "Scenario": scenario,
            "Cap Rate": f"{res['Cap Rate']:.2%}",
            "Cash Flow (Hold)": f"${res['Cash Flow']:,.0f}",
            "CoC Return": f"{res['CoC Return']:.2%}",
            "IRR": f"{res['IRR']:.2%}",
            "Value (x yrs)": f"${res['Value']:,.0f}",
            "Equity Gain": f"${res['Equity Gain']:,.0f}"
        })
    st.dataframe(pd.DataFrame(metrics))

    # Sensitivity Analysis (Rent +/-10%)
    st.markdown("## Sensitivity Analysis (IRR vs Rent)")
    sens = []
    for adj in [-0.1, -0.05, 0, 0.05, 0.1]:
        adj_rent = base_rent * (1 + adj)
        test = analyze_scenario(purchase_price, monthly_expenses, adj_rent, pdf_data['square_feet'],
                                base_down, base_int, base_app, hold_period, loan_term,
                                interest_only_years, pdf_data['cam_psf'], pdf_data['taxes_psf'])
        sens.append({"Rent Change": f"{adj*100:.0f}%", "IRR": f"{test['IRR']:.2%}"})
    st.dataframe(pd.DataFrame(sens))

    # Donut Chart Example
    st.markdown("## Donut Chart (Base Scenario)")
    base_schedule = results["Base"]["Schedule"]
    total_interest = base_schedule["Interest"].sum()
    total_principal = base_schedule["Principal"].sum()
    total_cash_flow = results["Base"]["Cash Flow"]
    fig = go.Figure(data=[go.Pie(labels=["Interest", "Principal", "Cash Flow"],
                                 values=[total_interest, total_principal, total_cash_flow],
                                 hole=.4)])
    st.plotly_chart(fig)

    # Time Series Chart Example
    st.markdown("## Equity & Cash Flow Over Time (Base Scenario)")
    time_series = base_schedule.copy()
    time_series["Equity"] = purchase_price - time_series["Balance"]
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(x=time_series["Month"], y=time_series["Equity"], mode='lines', name='Equity'))
    st.plotly_chart(fig2)
