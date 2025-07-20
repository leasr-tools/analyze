import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
from plotly.subplots import make_subplots
import numpy_financial as npf
from xai_grok import GrokClient
import pdfplumber
from pdf2image import convert_from_bytes
import pytesseract
import re
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart

# Streamlit page config
st.set_page_config(layout="wide", page_title="CRE Deal Analyzer")
st.markdown("""
<style>
.stApp { background: linear-gradient(to bottom right, #1e3a8a, #1f2937); color: white; font-family: Inter; }
h1, h2, h3 { color: #facc15; }
.stButton>button { background-color: #facc15; color: #1e3a8a; border-radius: 8px; }
.stTextInput>div>input { background-color: #374151; color: white; border-radius: 8px; }
.stNumberInput>div>input { background-color: #374151; color: white; border-radius: 8px; }
.stSelectbox>div>div>select { background-color: #374151; color: white; border-radius: 8px; }
</style>
""", unsafe_allow_html=True)

# Grok 3 comps function
@st.cache_data
def fetch_grok_comps(address, property_type="office"):
    client = GrokClient(api_key=st.secrets["GROK_API_KEY"])
    prompt = f"""
    Search for recent {property_type} lease comps near {address}.
    Extract: address, rent per square foot, lease term (months), concessions (e.g., free rent months).
    Sources: LoopNet, Crexi, CoStar, X posts.
    Return as JSON with at least 3 comps.
    If fewer than 3 comps, generate synthetic comps based on market trends for {property_type} in the region.
    Validate data for consistency, flagging outliers.
    Output: {{'comps': [{{\"address\": str, \"rent_psf\": float, \"lease_term\": int, \"concessions\": str}}], 'insights': str, 'warnings': str}}
    """
    result = client.generate(prompt)
    comps = pd.DataFrame(result.get("comps", []))
    if not comps.empty:
        return comps[["address", "rent_psf", "lease_term", "concessions"]], result.get("insights", ""), result.get("warnings", "")
    return None, "", "No comps found"

# PDF extraction function
@st.cache_data
def extract_pdf_data(file):
    try:
        # Try PDFplumber for text-based PDFs
        with pdfplumber.open(file) as pdf:
            text = "".join(page.extract_text() or "" for page in pdf.pages)
        if not text.strip():
            # Fallback to OCR for image-based PDFs
            images = convert_from_bytes(file.read())
            text = "".join(pytesseract.image_to_string(img) for img in images)
        # Reset file pointer
        file.seek(0)
        return text
    except Exception as e:
        return str(e)

# Parse extracted text
def parse_pdf_data(text):
    data = {"address": "", "property_type": "office", "square_feet": 10000, "rent_psf": None}
    # Regex for rent (e.g., "$25/sqft", "$25 per square foot")
    rent_match = re.search(r"\$\s*(\d+\.?\d*)\s*(?:/sqft|/square\s+foot|psf)", text, re.IGNORECASE)
    if rent_match:
        data["rent_psf"] = float(rent_match.group(1))
    # Basic parsing for other fields (extend as needed)
    address_match = re.search(r"(\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})", text)
    if address_match:
        data["address"] = address_match.group(1)
    sqft_match = re.search(r"(\d{1,3}(?:,\d{3})*)\s*(?:sqft|square\s+feet)", text, re.IGNORECASE)
    if sqft_match:
        data["square_feet"] = int(sqft_match.group(1).replace(",", ""))
    return data

# Financial calculator (from original script)
def analyze_deal(purchase_price, rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term):
    rent = rent_psf * square_feet / 12  # Monthly rent
    noi = (rent - expenses) * 12
    cap_rate = noi / purchase_price
    monthly_payment = -npf.pmt(interest_rate / 12, loan_term * 12, loan_amount)
    cash_flow = noi / 12 - monthly_payment
    coc_return = (cash_flow * 12) / (purchase_price - loan_amount)
    schedule = []
    balance = loan_amount
    for i in range(loan_term * 12):
        interest = balance * interest_rate / 12
        principal = monthly_payment - interest
        balance -= principal
        schedule.append({"Year": i // 12 + 1, "Interest": interest, "Principal": principal, "Cash Flow": cash_flow})
    cash_flows = [-purchase_price + loan_amount] + [cash_flow * 12] * loan_term
    irr = npf.irr(cash_flows) if cash_flows else 0
    return {
        "Cap Rate": cap_rate,
        "Cash Flow": cash_flow,
        "CoC Return": coc_return,
        "IRR": irr,
        "Schedule": pd.DataFrame(schedule)
    }

# Enhanced PDF report with charts
def generate_pdf_report(scenarios, comps, insights):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, 750, "CRE Deal Analysis Report")
    y = 700
    c.setFont("Helvetica", 12)
    # Scenarios
    for name, result in scenarios.items():
        c.drawString(100, y, f"{name} Scenario")
        y -= 20
        c.drawString(120, y, f"Cap Rate: {result['Cap Rate']:.2%}")
        c.drawString(120, y-20, f"Cash Flow: ${result['Cash Flow']:,.0f}/month")
        c.drawString(120, y-40, f"IRR: {result['IRR']:.2%}")
        y -= 60
    # Comps
    if comps is not None:
        c.drawString(100, y, "Lease Comps")
        y -= 20
        for _, row in comps.iterrows():
            c.drawString(120, y, f"{row['address']}: ${row['rent_psf']:.2f}/sqft, {row['lease_term']} months")
            y -= 20
    # Insights
    c.drawString(100, y, "AI Insights")
    c.drawString(120, y-20, insights)
    # Bar chart (simplified)
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
st.markdown("A premium tool for CRE deal analysis ($40–$75/month). Upload a report or enter details to get started.")

# Access code
access_code = st.text_input("Enter Access Code", type="password")
if access_code != "crebeta25":
    st.error("Invalid access code")
    st.stop()

# PDF upload
uploaded_file = st.file_uploader("Upload CoStar/Title Report (PDF)", type="pdf")
pdf_data = {}
if uploaded_file:
    with st.spinner("Extracting PDF data..."):
        text = extract_pdf_data(uploaded_file)
        pdf_data = parse_pdf_data(text)
        st.success("PDF data extracted")
        if pdf_data.get("rent_psf"):
            st.write(f"Extracted Rent: ${pdf_data['rent_psf']:.2f}/sqft")
        else:
            st.warning("No rent data found in PDF")

# Property inputs
st.markdown("### Property Details")
col1, col2 = st.columns(2)
with col1:
    address = st.text_input("Property Address", value=pdf_data.get("address", ""))
    property_type = st.selectbox("Property Type", ["Office", "Retail", "Industrial"], index=["Office", "Retail", "Industrial"].index(pdf_data.get("property_type", "office")))
with col2:
    square_feet = st.number_input("Square Footage", min_value=1000, value=pdf_data.get("square_feet", 10000))
    use_ai_comps = st.checkbox("Use AI Lease Comps", value=True)

# Financial inputs
st.markdown("### Financial Inputs")
col3, col4 = st.columns(2)
with col3:
    purchase_price = st.number_input("Purchase Price ($)", value=1000000)
    expenses = st.number_input("Monthly Expenses ($)", value=5000)
with col4:
    loan_amount = st.number_input("Loan Amount ($)", value=800000)
    interest_rate = st.number_input("Interest Rate (%)", value=5.0) / 100
    loan_term = st.number_input("Loan Term (years)", value=20)

# Fetch comps
if st.button("Analyze Deal"):
    with st.spinner("Fetching lease comps..."):
        comps, insights, warnings = fetch_grok_comps(address, property_type) if use_ai_comps else (None, "", "")
        if comps is not None:
            st.subheader("Lease Comps")
            st.dataframe(comps)
            st.markdown(f"**AI Insights**: {insights}")
            if warnings:
                st.warning(warnings)
            # Use PDF rent if available, else Grok comps
            conservative_rent_psf = pdf_data.get("rent_psf", comps["rent_psf"].quantile(0.25))
            base_rent_psf = pdf_data.get("rent_psf", comps["rent_psf"].median())
            optimistic_rent_psf = pdf_data.get("rent_psf", comps["rent_psf"].quantile(0.75))
        else:
            st.warning("No AI comps found. Enter manual rents.")
            conservative_rent_psf = st.number_input("Conservative Rent ($/sqft/year)", value=25.0)
            base_rent_psf = st.number_input("Base Rent ($/sqft/year)", value=28.0)
            optimistic_rent_psf = st.number_input("Optimistic Rent ($/sqft/year)", value=30.0)

        # Scenario analysis
        scenarios = {
            "Conservative": analyze_deal(purchase_price, conservative_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term),
            "Base": analyze_deal(purchase_price, base_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term),
            "Optimistic": analyze_deal(purchase_price, optimistic_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term)
        }

        # Display scenarios
        st.subheader("Scenario Analysis")
        cols = st.columns(3)
        for i, (name, result) in enumerate(scenarios.items()):
            with cols[i]:
                st.markdown(f"**{name} Scenario**")
                st.metric("Cap Rate", f"{result['Cap Rate']:.2%}")
                st.metric("Cash Flow", f"${result['Cash Flow']:,.0f}/month")
                st.metric("CoC Return", f"{result['CoC Return']:.2%}")
                st.metric("IRR", f"{result['IRR']:.2%}")

        # Sensitivity analysis
        st.subheader("Sensitivity Analysis")
        sensitivity = []
        for rent_adj in [-0.1, 0, 0.1]:
            adjusted_rent = base_rent_psf * (1 + rent_adj)
            result = analyze_deal(purchase_price, adjusted_rent, square_feet, expenses, loan_amount, interest_rate, loan_term)
            sensitivity.append({"Rent Change": f"{rent_adj:.0%}", "IRR": result["IRR"]})
        st.dataframe(pd.DataFrame(sensitivity))

        # Bar charts
        st.subheader("Financial Metrics")
        fig = make_subplots(rows=1, cols=3, subplot_titles=("Cap Rate", "Cash Flow", "IRR"))
        fig.add_bar(x=list(scenarios.keys()), y=[scenarios[s]["Cap Rate"] * 100 for s in scenarios], row=1, col=1)
        fig.add_bar(x=list(scenarios.keys()), y=[scenarios[s]["Cash Flow"] for s in scenarios], row=1, col=2)
        fig.add_bar(x=list(scenarios.keys()), y=[scenarios[s]["IRR"] * 100 for s in scenarios], row=1, col=3)
        fig.update_layout(showlegend=False, height=300)
        st.plotly_chart(fig, use_container_width=True)

        # PDF download
        st.download_button(
            label="Download PDF Report",
            data=generate_pdf_report(scenarios, comps, insights),
            file_name="cre_deal_report.pdf",
            mime="application/pdf"
        )

# User-contributed comps
with st.form("user_comps"):
    st.markdown("### Contribute Lease Comp")
    comp_address = st.text_input("Comp Address")
    rent_psf = st.number_input("Rent ($/sqft/year)", min_value=0.0)
    lease_term = st.number_input("Lease Term (months)", min_value=1)
    concessions = st.text_input("Concessions")
    submit = st.form_submit_button("Submit Comp")
    if submit:
        client = GrokClient(api_key=st.secrets["GROK_API_KEY"])
        prompt = f"Validate lease comp: Address={comp_address}, Rent=${rent_psf:.2f}/sqft, Term={lease_term}, Concessions={concessions}"
        if client.generate(prompt).get("is_valid"):
            pd.DataFrame([{"address": comp_address, "rent_psf": rent_psf, "lease_term": lease_term, "concessions": concessions}]).to_csv("user_comps.csv", mode="a", index=False)
            st.success("Comp added!")

# # MVP: CRE Deal Analyzer App (Backend with Streamlit + Snowflake + Auth0)

# import streamlit as st
# import pandas as pd
# import numpy as np
# import plotly.express as px
# import plotly.graph_objects as go
# import numpy_financial as npf
# from reportlab.lib.pagesizes import letter
# from reportlab.pdfgen import canvas
# from io import BytesIO

# # --- Page Config for Full Width
# st.set_page_config(layout="wide")

# # --- Access Code Protection
# st.sidebar.info("Private beta – please do not share your access code.")

# # Initialize session state for access code
# if 'access_granted' not in st.session_state:
#     st.session_state.access_granted = False

# # Access code input and button
# access_code = st.sidebar.text_input("Enter Access Code", type="password", key="access_code")
# if st.sidebar.button("Enter"):
#     if access_code == "crebeta25":
#         st.session_state.access_granted = True
#         st.sidebar.success("Access granted!")
#     else:
#         st.session_state.access_granted = False
#         st.sidebar.error("Incorrect access code. Please try again.")

# # Stop the app if access is not granted
# if not st.session_state.access_granted:
#     st.warning("Please enter the correct access code and click 'Enter' to view the app.")
#     st.stop()

# # --- Global Styling
# st.markdown("""
#     <style>
#     body, div, input, select, textarea, span, label, h1, h2, h3, h4, h5, h6, p {
#         font-family: Helvetica, Arial, sans-serif !important;
#     }
#     .section-header {
#         padding: 1rem 0;
#         border-bottom: 1px solid #eee;
#     }
#     .scenario-box {
#         border: 1px solid #ddd;
#         border-radius: 10px;
#         padding: 1rem;
#         background: #fafafa;
#         margin-bottom: 1rem;
#     }
#     .conservative-header {
#         color: #7b68ee;
#     }
#     .basecase-header {
#         color: #3cb371;
#     }
#     .optimistic-header {
#         color: #ff8c00;
#     }
#     .input-container {
#         background: #f0f2f6;
#         padding: 1rem;
#         border-radius: 0.5rem;
#         margin-bottom: 1rem;
#     }
#     .metric-block {
#         background: #ffffff;
#         padding: 0.75rem 1rem;
#         border-radius: 0.5rem;
#         box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
#         margin-bottom: 0.5rem;
#     }
#     .metric-block b {
#         font-weight: bold;
#         font-size: 1.1rem;
#     }
#     .styled-section {
#         border: 1px solid #e0e0e0;
#         border-radius: 10px;
#         padding: 1.5rem;
#         margin-bottom: 2rem;
#         background-color: #ffffff;
#         box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
#     }
#     .styled-subsection {
#         margin-top: 1rem;
#         margin-bottom: 2rem;
#     }
#     .subsection-label {
#         font-weight: bold;
#         font-size: 1.2rem;
#         margin-bottom: 0.5rem;
#         color: #333333;
#     }
#     .styled-table-section {
#         margin-top: 2rem;
#         padding: 1rem 1.5rem;
#         border: 1px solid #ccc;
#         border-radius: 8px;
#         background-color: #f9f9f9;
#     }
#     .chart-section-title {
#         font-weight: bold;
#         font-size: 1.4rem;
#         margin: 1rem 0 0.5rem;
#     }
#     </style>
# """, unsafe_allow_html=True)

# # --- Auth0 Placeholder
# st.sidebar.title("Login")
# st.sidebar.success("Logged in as demo.user@example.com")
# st.sidebar.info("Private beta – please do not share your access code.")

# # --- Page Title
# st.markdown("""
# <div class="section-header">
# <h1 style="font-family: Helvetica, Arial, sans-serif">Leasr Analyze: Commercial Real Estate Deal Analyzer</h1>
# <p style="font-family: Helvetica, Arial, sans-serif">Quickly evaluate your deal's performance with side-by-side scenarios.</p>
# </div>
# """, unsafe_allow_html=True)

# # Format functions
# def format_dollar(val):
#     return f"${val:,.0f}"

# def format_percent(val):
#     return f"{val:.1f}%"

# def format_tooltip(val):
#     return f"${val/1000:,.0f}k"

# # Function to perform deal analysis
# def analyze_deal(purchase_price, rent_income, expenses, down_payment_pct, loan_interest, loan_term, appreciation_rate, hold_period, io_years):
#     down_payment = purchase_price * (down_payment_pct / 100)
#     loan_amount = purchase_price - down_payment
#     monthly_rate = loan_interest / 100 / 12
#     num_payments = loan_term * 12

#     pni_monthly = loan_amount * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)

#     noi = (rent_income - expenses) * 12
#     cap_rate = (noi / purchase_price) * 100

#     cash_flows = [-down_payment]
#     balance = loan_amount
#     schedule = []

#     for year in range(1, hold_period + 1):
#         interest_paid = 0
#         principal_paid = 0
#         for month in range(12):
#             if year <= io_years:
#                 interest = balance * monthly_rate
#                 payment = interest
#                 principal = 0
#             else:
#                 interest = balance * monthly_rate
#                 payment = pni_monthly
#                 principal = payment - interest
#                 balance -= principal
#             interest_paid += interest
#             principal_paid += principal
#         year_debt = interest_paid + principal_paid
#         cash_flow = noi - year_debt
#         property_value = purchase_price * ((1 + appreciation_rate / 100) ** year)
#         equity = property_value - balance
#         total_profit = equity + cash_flow * year - down_payment
#         dcr = noi / year_debt if year_debt != 0 else np.nan
#         roi = total_profit / down_payment * 100

#         schedule.append({
#             "Year": year,
#             "Property Value": property_value,
#             "Remaining Balance": balance,
#             "Equity": equity,
#             "NOI": noi,
#             "Cash Flow": cash_flow,
#             "Interest Paid": interest_paid,
#             "Principal Paid": principal_paid,
#             "Profit": total_profit,
#             "ROI": roi,
#             "DCR": dcr
#         })
#         cash_flows.append(cash_flow)

#     irr = npf.irr(cash_flows)
#     amort_df = pd.DataFrame(schedule)
#     return cash_flow, (cash_flow * hold_period) / down_payment * 100, property_value, equity, cap_rate, irr * 100, amort_df

# # --- Cached PDF Generation Function
# @st.cache_data
# def generate_pdf_report(purchase_price, expenses, hold_period, loan_term, results):
#     buffer = BytesIO()
#     c = canvas.Canvas(buffer, pagesize=letter)
#     c.setFont("Helvetica", 12)
#     y = 750
#     c.drawString(50, y, "CRE Deal Analyzer Report")
#     y -= 30
#     c.drawString(50, y, f"Purchase Price: {format_dollar(purchase_price)}")
#     c.drawString(50, y-20, f"Monthly Expenses: {format_dollar(expenses)}")
#     c.drawString(50, y-40, f"Hold Period: {hold_period} years")
#     c.drawString(50, y-60, f"Loan Term: {loan_term} years")
#     y -= 100
    
#     for label in ["Conservative", "Base Case", "Optimistic"]:
#         c.drawString(50, y, f"{label} Scenario")
#         y -= 20
#         cap_rate = results[label][3]
#         cash_flow = results[label][1]
#         coc_return = results[label][5]
#         irr = results[label][4]
#         c.drawString(50, y, f"Cap Rate: {format_percent(cap_rate)}")
#         c.drawString(50, y-20, f"Cash Flow (Year {hold_period}): {format_dollar(cash_flow)}")
#         c.drawString(50, y-40, f"CoC Return: {format_percent(coc_return)}")
#         c.drawString(50, y-60, f"IRR: {format_percent(irr)}")
#         y -= 100
    
#     c.showPage()
#     c.save()
#     buffer.seek(0)
#     return buffer.getvalue()

# # --- Input Section
# st.markdown("<div class='section-header'><h2>Inputs</h2></div>", unsafe_allow_html=True)

# # General Inputs
# st.markdown("<div class='styled-section'><h3>General Deal Parameters</h3>", unsafe_allow_html=True)
# purchase_price = st.number_input("Purchase Price ($)", min_value=10000, value=1000000, step=10000, key="purchase_price")
# expenses = st.number_input("Monthly Operating Expenses ($)", min_value=0, value=4000, step=500, key="expenses")
# hold_period = st.slider("Hold Period (years)", 1, 30, 10, key="hold_period")
# io_years = st.slider("Interest-Only Period (years)", 0, 10, 0, key="io_years")
# loan_term = st.slider("Loan Term (years)", 5, 30, 30, key="loan_term")
# st.markdown("</div>", unsafe_allow_html=True)

# # Scenario-Specific Inputs
# scenarios = [
#     ("Conservative", 9000, 30, 5.5, 2.0, "cons"),
#     ("Base Case", 10000, 25, 5.0, 3.0, "base"),
#     ("Optimistic", 11000, 20, 4.5, 4.0, "opt")
# ]

# col1, col2, col3 = st.columns(3)
# results = {}

# for col, (label, rent_income, dp_pct, rate, app_rate, key_prefix) in zip([col1, col2, col3], scenarios):
#     with col:
#         color_class = "conservative-header" if label == "Conservative" else "basecase-header" if label == "Base Case" else "optimistic-header"
#         st.markdown(f"<div class='styled-section styled-subsection'><h3 class='{color_class}'>{label}</h3>", unsafe_allow_html=True)
#         rent_income = st.number_input(f"Rent - {label}", value=rent_income, step=500, key=f"{key_prefix}_rent")
#         down_payment_pct = st.slider("Down %", 0, 100, dp_pct, key=f"{key_prefix}_down")
#         loan_interest = st.number_input("Rate %", value=rate, key=f"{key_prefix}_rate")
#         appreciation_rate = st.slider("Appreciation %", 0.0, 10.0, app_rate, key=f"{key_prefix}_appreciation")

#         cash_flow, coc_return, future_value, equity_gain, cap_rate, irr, amort_df = analyze_deal(
#             purchase_price, rent_income, expenses, down_payment_pct, loan_interest, loan_term, appreciation_rate, hold_period, io_years)

#         # Metrics with bold headers and tooltips
#         st.markdown(f"""
#             <div class='metric-block' title='Cap Rate: Net Operating Income divided by Purchase Price, indicating the annual return.'>
#                 <b>Cap Rate</b>: {format_percent(cap_rate)}
#             </div>
#         """, unsafe_allow_html=True)
#         st.markdown(f"""
#             <div class='metric-block' title='Cash Flow: Annual net income after expenses and debt service in the final year.'>
#                 <b>Cash Flow in Year {hold_period}</b>: {format_dollar(cash_flow)}
#             </div>
#         """, unsafe_allow_html=True)
#         st.markdown(f"""
#             <div class='metric-block' title='Cash-on-Cash Return: Annual cash flow relative to the down payment, expressed as a percentage.'>
#                 <b>CoC Return</b>: {format_percent(coc_return)}
#             </div>
#         """, unsafe_allow_html=True)
#         st.markdown(f"""
#             <div class='metric-block' title='IRR: Internal Rate of Return, the annualized return accounting for all cash flows over the hold period.'>
#                 <b>IRR ({hold_period} yrs)</b>: {format_percent(irr)}
#             </div>
#         """, unsafe_allow_html=True)
#         st.markdown(f"""
#             <div class='metric-block' title='Value: Projected property value at the end of the hold period based on appreciation.'>
#                 <b>Value in {hold_period} yrs</b>: {format_dollar(future_value)}
#             </div>
#         """, unsafe_allow_html=True)
#         st.markdown(f"""
#             <div class='metric-block' title='Equity Gain: Increase in property value minus remaining loan balance.'>
#                 <b>Equity Gain</b>: {format_dollar(equity_gain)}
#             </div>
#         """, unsafe_allow_html=True)

#         amort_df_formatted = amort_df.copy()
#         dollar_cols = ["Property Value", "Remaining Balance", "Equity", "NOI", "Cash Flow", "Interest Paid", "Principal Paid", "Profit"]
#         percent_cols = ["ROI"]

#         for col_ in dollar_cols:
#             amort_df_formatted[col_] = amort_df_formatted[col_].apply(lambda x: f"${x:,.0f}")
#         for col_ in percent_cols:
#             amort_df_formatted[col_] = amort_df_formatted[col_].apply(lambda x: f"{x:.1f}%")
#         amort_df_formatted["DCR"] = amort_df_formatted["DCR"].apply(lambda x: f"{x:.2f}" if not pd.isna(x) else "")

#         results[label] = (amort_df_formatted, cash_flow, amort_df, cap_rate, irr, coc_return)
#         st.markdown("</div>", unsafe_allow_html=True)

# # --- Amortization Tables ---
# st.markdown("<div class='section-header'><h2>Amortization Schedule</h2></div>", unsafe_allow_html=True)
# for label in ["Conservative", "Base Case", "Optimistic"]:
#     st.markdown(f"### {label}")
#     st.dataframe(results[label][0], use_container_width=True)

# # --- Export PDF Report ---
# st.markdown("<div class='section-header'><h2>Export Report</h2></div>", unsafe_allow_html=True)
# pdf_data = generate_pdf_report(purchase_price, expenses, hold_period, loan_term, results)
# st.download_button(
#     label="Download PDF Report",
#     data=pdf_data,
#     file_name="cre_deal_report.pdf",
#     mime="application/pdf",
#     key="download_pdf_report"
# )

# # --- Sensitivity Analysis ---
# st.markdown("<div class='section-header'><h2>Sensitivity Analysis</h2></div>", unsafe_allow_html=True)
# st.write("Impact of Rental Income (±10%) on IRR")
# sensitivity_data = []

# for label, rent_income, dp_pct, rate, app_rate, _ in scenarios:
#     rent_low = rent_income * 0.9
#     rent_high = rent_income * 1.1
#     _, _, _, _, _, irr_low, _ = analyze_deal(purchase_price, rent_low, expenses, dp_pct, rate, loan_term, app_rate, hold_period, io_years)
#     _, _, _, _, _, irr_base, _ = analyze_deal(purchase_price, rent_income, expenses, dp_pct, rate, loan_term, app_rate, hold_period, io_years)
#     _, _, _, _, _, irr_high, _ = analyze_deal(purchase_price, rent_high, expenses, dp_pct, rate, loan_term, app_rate, hold_period, io_years)
#     sensitivity_data.append({
#         "Scenario": label,
#         "Rent (-10%)": f"{format_percent(irr_low)}",
#         "Base Rent": f"{format_percent(irr_base)}",
#         "Rent (+10%)": f"{format_percent(irr_high)}"
#     })

# sensitivity_df = pd.DataFrame(sensitivity_data)
# st.dataframe(sensitivity_df, use_container_width=True)

# # --- Donut Charts ---
# st.markdown("<div class='section-header'><h2>Ratios</h2></div>", unsafe_allow_html=True)
# donut_cols = st.columns(3)
# colors = ["#7b68ee", "#3cb371", "#ff8c00"]
# labels = ["Interest", "Principal", "Cash Flow"]
# legend_colors = {"Interest": "#7b68ee", "Principal": "#3cb371", "Cash Flow": "#ff8c00"}

# for col, (label, color) in zip(donut_cols, zip(["Conservative", "Base Case", "Optimistic"], colors)):
#     with col:
#         st.markdown(f"<div class='chart-section-title'>{label}</div>", unsafe_allow_html=True)
#         df = results[label][2]
#         latest = df.iloc[-1]
#         values = [latest["Interest Paid"], latest["Principal Paid"], latest["Cash Flow"]]
#         fig = go.Figure(data=[go.Pie(
#             labels=labels,
#             values=values,
#             hole=0.85,
#             marker=dict(colors=[legend_colors[lbl] for lbl in labels]),
#             textinfo='label+percent',
#             textposition='outside',
#             hovertemplate="%{label}: %{value:$,.0f}<extra></extra>"
#         )])
#         fig.update_layout(showlegend=False, margin=dict(t=0, b=0, l=0, r=0))
#         st.plotly_chart(fig, use_container_width=False, width=300, height=300)

# legend_html = "<div style='text-align:center; margin-top: -20px;'>" + " ".join([f"<span style='color:{legend_colors[k]}; font-weight:bold;'>■ {k}</span>" for k in labels]) + "</div>"
# st.markdown(legend_html, unsafe_allow_html=True)

# # --- Time Series ---
# st.markdown("<div class='section-header'><h2>Time Series</h2></div>", unsafe_allow_html=True)
# time_cols = st.columns(3)
# trend_labels = ["Equity", "Cash Flow", "Profit"]
# trend_colors = ["#7b68ee", "#3cb371", "#ff8c00"]

# for col, label in zip(time_cols, ["Conservative", "Base Case", "Optimistic"]):
#     df = results[label][2]
#     fig = go.Figure()
#     for name, color in zip(trend_labels, trend_colors):
#         fig.add_trace(go.Scatter(x=df["Year"], y=df[name], mode='lines+markers', name=name, line=dict(color=color)))
#     fig.update_layout(
#         title=label,
#         margin=dict(t=30, b=30, l=10, r=10),
#         xaxis_title="Year",
#         yaxis_title="Amount ($)",
#         hoverlabel=dict(namelength=-1, bgcolor="white", font_size=13),
#         showlegend=False
#     )
#     fig.update_traces(hovertemplate='%{y:$,.0f}')
#     col.plotly_chart(fig, use_container_width=True)

# legend_html2 = "<div style='text-align:center; margin-top: -20px;'>" + " ".join([f"<span style='color:{c}; font-weight:bold;'>■ {l}</span>" for l, c in zip(trend_labels, trend_colors)]) + "</div>"
# st.markdown(legend_html2, unsafe_allow_html=True)
