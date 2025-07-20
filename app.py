import streamlit as st
import pandas as pd
import numpy as np
import numpy_financial as npf
import pdfplumber
from pdf2image import convert_from_bytes
import pytesseract
import re
import plotly.graph_objects as go

# Mock GrokClient for market benchmarking (replace with xai-grok when available)
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

# Grok 3 comps function
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
def extract_pdf_text(file):
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
def parse_summary_data(text):
    data = {
        "rent_psf": 28.0, "cam_psf": 5.0, "taxes_psf": 2.0,
        "square_feet": 10000, "purchase_price": 1000000, "opex_psf": 3.0,
        "property_type": "Office"
    }
    rent_match = re.search(r"\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|/square\s+foot|/sf/yr|/yr|psf|per\s+sf(?:/yr)?)", text, re.IGNORECASE)
    if rent_match:
        data["rent_psf"] = min(float(rent_match.group(1)), 100.0)  # Cap at $100/SF
    cam_match = re.search(r"(?:CAM|common\s+area\s+maintenance)\s*[:=]?\s*\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf)", text, re.IGNORECASE)
    if cam_match:
        data["cam_psf"] = min(float(cam_match.group(1)), 50.0)  # Cap at $50/SF
    tax_match = re.search(r"(?:tax|taxes)\s*[:=]?\s*\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf)", text, re.IGNORECASE)
    if tax_match:
        data["taxes_psf"] = min(float(tax_match.group(1)), 50.0)  # Cap at $50/SF
    sqft_match = re.search(r"(\d{1,3}(?:,\d{3})*|\d+)\s*(?:sqft|sf|square\s+feet)", text, re.IGNORECASE)
    if sqft_match:
        data["square_feet"] = max(int(sqft_match.group(1).replace(",", "")), 1000)  # Min 1000 SF
    price_match = re.search(r"(?:purchase\s+price|price)\s*[:=]?\s*\$\s*(\d{1,3}(?:,\d{3})*)", text, re.IGNORECASE)
    if price_match:
        data["purchase_price"] = max(float(price_match.group(1).replace(",", "")), 100000)  # Min $100,000
    opex_match = re.search(r"(?:operating\s+expenses|opex)\s*[:=]?\s*\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|psf)", text, re.IGNORECASE)
    if opex_match:
        data["opex_psf"] = min(float(opex_match.group(1)), 50.0)  # Cap at $50/SF
    type_match = re.search(r"\b(office|retail|industrial)\b", text, re.IGNORECASE)
    if type_match:
        data["property_type"] = type_match.group(1).capitalize()
    return data

# Financial engine
def amortization_schedule(loan_amount, annual_rate, term_years, interest_only_years=0):
    schedule = []
    monthly_rate = annual_rate / 100 / 12
    n_months = term_years * 12
    balance = max(loan_amount, 0)  # Ensure non-negative loan
    monthly_payment = 0 if interest_only_years > 0 else -npf.pmt(monthly_rate, n_months, balance, when='end')

    for month in range(1, n_months + 1):
        if month <= interest_only_years * 12:
            interest = balance * monthly_rate
            principal = 0
            payment = interest
        else:
            if month == interest_only_years * 12 + 1:
                monthly_payment = -npf.pmt(monthly_rate, n_months - interest_only_years * 12, balance, when='end')
            interest = balance * monthly_rate
            principal = monthly_payment - interest
            payment = monthly_payment
            balance = max(balance - principal, 0)  # Prevent negative balance
        schedule.append({
            "Month": month,
            "Payment": payment,
            "Principal": principal,
            "Interest": interest,
            "Balance": balance
        })
    return pd.DataFrame(schedule)

def analyze_scenario(purchase_price, monthly_expenses, rent_psf, square_feet, downpayment_pct, interest_rate, appreciation_pct, hold_period, loan_term, interest_only_years, cam_psf, taxes_psf):
    # Input validation
    purchase_price = max(purchase_price, 100000)  # Min $100,000
    monthly_expenses = max(monthly_expenses, 0)  # Non-negative
    rent_psf = min(max(rent_psf, 0), 100)  # 0–$100/SF
    square_feet = max(square_feet, 1000)  # Min 1000 SF
    downpayment_pct = min(max(downpayment_pct, 0), 100)  # 0–100%
    interest_rate = min(max(interest_rate, 0), 20)  # 0–20%
    appreciation_pct = min(max(appreciation_pct, 0), 10)  # 0–10%
    hold_period = min(max(hold_period, 1), 30)  # 1–30 years
    loan_term = min(max(loan_term, hold_period), 30)  # Ensure loan_term >= hold_period
    interest_only_years = min(max(interest_only_years, 0), loan_term)  # 0–loan_term
    cam_psf = min(max(cam_psf, 0), 50)  # 0–$50/SF
    taxes_psf = min(max(taxes_psf, 0), 50)  # 0–$50/SF

    downpayment = purchase_price * (downpayment_pct / 100)
    loan_amount = purchase_price - downpayment

    # Annual NOI
    monthly_rent = (rent_psf * square_feet) / 12
    annual_rent = monthly_rent * 12
    annual_expenses = (monthly_expenses * 12) + (cam_psf * square_feet) + (taxes_psf * square_feet)
    noi = annual_rent - annual_expenses

    # Cap Rate
    cap_rate = noi / purchase_price if purchase_price > 0 else 0
    cap_rate = min(max(cap_rate, 0), 0.2)  # Cap at 0–20%

    # Loan Amortization
    schedule = amortization_schedule(loan_amount, interest_rate, loan_term, interest_only_years)
    loan_balance_end = schedule.loc[min(hold_period * 12 - 1, len(schedule) - 1), "Balance"] if hold_period * 12 <= len(schedule) else 0

    # Annual Cash Flow
    monthly_debt_service = schedule.loc[:min(hold_period * 12 - 1, len(schedule) - 1), "Payment"].sum() / min(hold_period * 12, len(schedule))
    annual_cash_flow = (noi / 12 - monthly_debt_service) * 12
    total_cash_flow = annual_cash_flow * hold_period

    # Future Sale & Net Proceeds
    future_value = purchase_price * (1 + appreciation_pct / 100) ** hold_period
    net_sale_proceeds = future_value - loan_balance_end
    equity_gain = net_sale_proceeds - downpayment + total_cash_flow

    # Returns
    coc_return = annual_cash_flow / downpayment if downpayment > 0 else 0
    coc_return = min(max(coc_return, 0), 1.0)  # Cap at 0–100%
    irr_cashflows = [-downpayment] + [annual_cash_flow] * (hold_period - 1) + [annual_cash_flow + net_sale_proceeds]
    irr = npf.irr(irr_cashflows) if irr_cashflows and not any(np.isnan(irr_cashflows)) else 0
    irr = min(max(irr, -1.0), 1.0)  # Cap at -100% to 100%

    return {
        "Cap Rate": cap_rate,
        "Cash Flow": total_cash_flow,
        "CoC Return": coc_return,
        "IRR": irr,
        "Value": future_value,
        "Equity Gain": equity_gain,
        "Schedule": schedule,
        "NOI": noi
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

def sensitivity_analysis_all(general, scenarios):
    data = {}
    for scenario_name, params in scenarios.items():
        scenario_data = []
        for adj in [-0.10, -0.05, 0, 0.05, 0.10]:
            adj_rent = params["rent"] * (1 + adj)
            s = analyze_scenario(
                general["purchase_price"], general["monthly_expenses"],
                adj_rent, general["square_feet"], params["downpayment"],
                params["interest_rate"], params["appreciation"],
                general["hold_period"], general["loan_term"],
                general["interest_only_years"], general["cam_psf"], general["taxes_psf"]
            )
            scenario_data.append(f"{s['IRR']:.2%}")
        data[scenario_name] = scenario_data
    return pd.DataFrame(data, index=["-10%", "-5%", "0%", "+5%", "+10%"])

def build_time_series(schedule, purchase_price, monthly_noi):
    df = schedule.copy()
    df["Equity"] = purchase_price - df["Balance"]
    df["Monthly Cash Flow"] = monthly_noi - df["Payment"]  # Use Payment directly
    df["Cumulative Cash Flow"] = df["Monthly Cash Flow"].cumsum()
    df["Profit"] = df["Equity"] + df["Cumulative Cash Flow"]
    df["Year"] = (df["Month"] / 12).round(1)
    return df

# Main app
st.title("CRE Deal Analyzer")

# Access code
access_code = st.text_input("Enter Access Code", type="password")
if access_code != "crebeta25":
    st.error("Invalid access code")
    st.stop()

# Step 1: Comp Input
st.markdown("## Step 1: Comp Input")
comp_input = st.radio("How would you like to input comps?", ["Upload CoStar/Title Report", "Manual Input"])
pdf_data = {
    "rent_psf": 28.0, "cam_psf": 5.0, "taxes_psf": 2.0,
    "square_feet": 10000, "purchase_price": 1000000, "opex_psf": 3.0,
    "property_type": "Office"
}
address = ""

if comp_input == "Upload CoStar/Title Report":
    uploaded_file = st.file_uploader("Upload PDF", type="pdf")
    if uploaded_file:
        with st.spinner("Extracting PDF data..."):
            text = extract_pdf_text(uploaded_file)
            pdf_data.update({k: v for k, v in parse_summary_data(text).items() if v is not None})
            address = pdf_data.get("address", "")
        st.success("Data Extracted from PDF:")
        st.markdown(f"""
        - **Rent per Sqft:** ${pdf_data['rent_psf']:.2f}/year
        - **CAM:** ${pdf_data['cam_psf']:.2f}/sqft/year
        - **Taxes:** ${pdf_data['taxes_psf']:.2f}/sqft/year
        - **Operating Expenses:** ${pdf_data['opex_psf']:.2f}/sqft/year
        - **Square Footage:** {pdf_data['square_feet']:,} sqft
        - **Purchase Price:** ${pdf_data['purchase_price']:,.0f}
        - **Property Type:** {pdf_data['property_type']}
        """)
else:
    st.info("Enter manual comp data below:")
    col_manual1, col_manual2 = st.columns(2)
    with col_manual1:
        pdf_data["rent_psf"] = st.number_input("Rent ($/sqft/year)", value=28.0, min_value=0.0, max_value=100.0, key="manual_rent")
        pdf_data["cam_psf"] = st.number_input("CAM ($/sqft/year)", value=5.0, min_value=0.0, max_value=50.0, key="manual_cam")
        pdf_data["taxes_psf"] = st.number_input("Taxes ($/sqft/year)", value=2.0, min_value=0.0, max_value=50.0, key="manual_taxes")
    with col_manual2:
        pdf_data["opex_psf"] = st.number_input("Operating Expenses ($/sqft/year)", value=3.0, min_value=0.0, max_value=50.0, key="manual_opex")
        pdf_data["square_feet"] = st.number_input("Square Feet", value=10000, min_value=1000, key="manual_sf")
        pdf_data["purchase_price"] = st.number_input("Purchase Price ($)", value=1000000, min_value=100000, key="manual_price")
        pdf_data["property_type"] = st.selectbox("Property Type", ["Office", "Retail", "Industrial"], key="manual_type")
    address = st.text_input("Property Address", help="Enter a valid U.S. address (e.g., 123 Main St, City, ST 12345)", key="manual_address")

# Step 2: General Parameters
st.markdown("## Step 2: General Parameters")
col_gen1, col_gen2, col_gen3 = st.columns(3)
with col_gen1:
    purchase_price = st.number_input("Purchase Price ($)", value=pdf_data['purchase_price'], min_value=100000, key="gen_price")
    monthly_expenses = st.number_input("Monthly Operating Expenses ($)", value=pdf_data['opex_psf'] * pdf_data['square_feet'] / 12, min_value=0.0, key="gen_expenses")
with col_gen2:
    hold_period = st.number_input("Hold Period (years)", min_value=1, max_value=30, value=5, key="gen_hold")
    interest_only_years = st.number_input("Interest-Only Period (years)", min_value=0, max_value=10, value=2, key="gen_io")
with col_gen3:
    loan_term = st.number_input("Loan Term (years)", min_value=1, max_value=30, value=20, key="gen_term")

# Step 3: Scenario Parameters
st.markdown("## Step 3: Scenario Parameters")
col_cons, col_base, col_opt = st.columns(3)
with col_cons:
    st.markdown("### Conservative")
    cons_rent = st.number_input("Rent ($/sqft/year)", value=pdf_data['rent_psf'] * 0.9, min_value=0.0, max_value=100.0, key="cons_rent")
    cons_down = st.number_input("Downpayment (%)", value=25.0, min_value=0.0, max_value=100.0, key="cons_down")
    cons_int = st.number_input("Interest Rate (%)", value=5.5, min_value=0.0, max_value=20.0, key="cons_int")
    cons_app = st.number_input("Appreciation (%)", value=2.0, min_value=0.0, max_value=10.0, key="cons_app")
with col_base:
    st.markdown("### Base")
    base_rent = st.number_input("Rent ($/sqft/year)", value=pdf_data['rent_psf'], min_value=0.0, max_value=100.0, key="base_rent")
    base_down = st.number_input("Downpayment (%)", value=20.0, min_value=0.0, max_value=100.0, key="base_down")
    base_int = st.number_input("Interest Rate (%)", value=5.0, min_value=0.0, max_value=20.0, key="base_int")
    base_app = st.number_input("Appreciation (%)", value=3.0, min_value=0.0, max_value=10.0, key="base_app")
with col_opt:
    st.markdown("### Optimistic")
    opt_rent = st.number_input("Rent ($/sqft/year)", value=pdf_data['rent_psf'] * 1.1, min_value=0.0, max_value=100.0, key="opt_rent")
    opt_down = st.number_input("Downpayment (%)", value=15.0, min_value=0.0, max_value=100.0, key="opt_down")
    opt_int = st.number_input("Interest Rate (%)", value=4.5, min_value=0.0, max_value=20.0, key="opt_int")
    opt_app = st.number_input("Appreciation (%)", value=4.0, min_value=0.0, max_value=10.0, key="opt_app")

# Step 4: Market Benchmarking
st.markdown("## Step 4: Market Benchmarking")
use_ai_comps = st.checkbox("Use AI Lease Comps for Benchmarking", value=True)
if use_ai_comps and address:
    comps, benchmarks, insights, warnings = fetch_grok_comps(address, pdf_data["property_type"])
    if comps is not None:
        st.subheader("Lease Comps")
        st.dataframe(comps)
        st.markdown(f"**AI Insights**: {insights}")
        if warnings:
            st.warning(warnings)
        st.subheader("Market Benchmarking")
        benchmark_data = [
            {"Metric": "Rent ($/sqft)", "Analyzer (Base)": base_rent, "Market Avg": benchmarks["avg_rent_psf"], "Status": "Over" if base_rent > benchmarks["avg_rent_psf"] else "Under" if base_rent < benchmarks["avg_rent_psf"] else "Aligned"},
            {"Metric": "CAM ($/sqft)", "Analyzer (Base)": pdf_data["cam_psf"], "Market Avg": benchmarks["avg_cam_psf"], "Status": "High" if pdf_data["cam_psf"] > benchmarks["avg_cam_psf"] else "Low" if pdf_data["cam_psf"] < benchmarks["avg_cam_psf"] else "Aligned"},
            {"Metric": "Taxes ($/sqft)", "Analyzer (Base)": pdf_data["taxes_psf"], "Market Avg": benchmarks["avg_taxes_psf"], "Status": "High" if pdf_data["taxes_psf"] > benchmarks["avg_taxes_psf"] else "Low" if pdf_data["taxes_psf"] < benchmarks["avg_taxes_psf"] else "Aligned"}
        ]
        st.dataframe(pd.DataFrame(benchmark_data))

# Run Analysis
if st.button("Analyze Deal"):
    with st.spinner("Analyzing deal..."):
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

        # Results Matrix
        st.markdown("## Results")
        metrics = pd.DataFrame({
            scenario: {
                "Cap Rate": f"{res['Cap Rate']:.2%}",
                "Cash Flow (Hold)": f"${res['Cash Flow']:,.0f}",
                "CoC Return": f"{res['CoC Return']:.2%}",
                "IRR": f"{res['IRR']:.2%}",
                "Value (x yrs)": f"${res['Value']:,.0f}",
                "Equity Gain": f"${res['Equity Gain']:,.0f}"
            } for scenario, res in results.items()
        })
        st.dataframe(metrics)

        # Sensitivity Analysis
        st.markdown("## Sensitivity Analysis (IRR vs Rent)")
        st.dataframe(sensitivity_analysis_all(general, scenarios))

        # Donut Charts
        st.markdown("## Financial Breakdown (All Scenarios)")
        donut_cols = st.columns(3)
        for i, (scenario, res) in enumerate(results.items()):
            with donut_cols[i]:
                s = res["Schedule"]
                total_interest = s["Interest"].sum()
                total_principal = s["Principal"].sum()
                total_cash_flow = res["Cash Flow"]
                fig = go.Figure(data=[go.Pie(labels=["Interest", "Principal", "Cumulative Cash Flow"],
                                             values=[total_interest, total_principal, total_cash_flow], hole=.4)])
                fig.update_layout(title_text=scenario)
                st.plotly_chart(fig)

        # Time Series Chart
        st.markdown("## Equity, Cumulative Cash Flow, and Profit Over Time")
        fig3 = go.Figure()
        for scenario, res in results.items():
            schedule = res["Schedule"]
            monthly_noi = (scenarios[scenario]["rent"] * pdf_data['square_feet']) / 12 - (
                monthly_expenses + pdf_data['cam_psf'] * pdf_data['square_feet'] / 12 + pdf_data['taxes_psf'] * pdf_data['square_feet'] / 12)
            ts = build_time_series(schedule, purchase_price, monthly_noi)
            fig3.add_trace(go.Scatter(x=ts["Year"], y=ts["Profit"], mode='lines', name=f'{scenario} Profit'))
            fig3.add_trace(go.Scatter(x=ts["Year"], y=ts["Cumulative Cash Flow"], mode='lines', name=f'{scenario} Cumulative CF'))
            fig3.add_trace(go.Scatter(x=ts["Year"], y=ts["Equity"], mode='lines', name=f'{scenario} Equity'))
        fig3.update_layout(xaxis_title="Years")
        st.plotly_chart(fig3)

        # Amortization Schedule
        st.markdown("## Amortization Schedule (Base Scenario)")
        st.dataframe(results["Base"]["Schedule"])

# User-contributed comps
with st.form("user_comps"):
    st.markdown("## Contribute Lease Comp")
    comp_address = st.text_input("Comp Address", help="Enter a valid U.S. address (e.g., 123 Main St, City, ST 12345)", key="comp_address")
    comp_rent_psf = st.number_input("Rent ($/sqft/year)", min_value=0.0, max_value=100.0, key="comp_rent")
    comp_cam_psf = st.number_input("CAM ($/sqft/year)", min_value=0.0, max_value=50.0, value=5.0, key="comp_cam")
    comp_taxes_psf = st.number_input("Taxes ($/sqft/year)", min_value=0.0, max_value=50.0, value=2.0, key="comp_taxes")
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
