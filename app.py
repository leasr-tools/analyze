import streamlit as st
import pandas as pd
import numpy as np
from plotly.subplots import make_subplots
import numpy_financial as npf
import pdfplumber
from pdf2image import convert_from_bytes
import pytesseract
import re

# --- Streamlit Config ---
st.set_page_config(layout="wide", page_title="CRE Deal Analyzer")
st.title("CRE Deal Analyzer")

# --- PDF Extraction Functions ---
def extract_pdf_text(file):
    """Extract all text from PDF pages or fallback to OCR."""
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
    """Extract key summary values like rent, CAM, taxes, square footage."""
    data = {"address": "", "property_type": "Office", "square_feet": 10000,
            "rent_psf": 28.0, "cam_psf": 5.0, "taxes_psf": 2.0}
    rent_match = re.search(r"\$\s*(\d+\.?\d*)\s*(?:/sqft|/sf|/yr|psf)", text, re.IGNORECASE)
    if rent_match:
        data["rent_psf"] = float(rent_match.group(1))
    address_match = re.search(r"(\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})", text, re.IGNORECASE)
    if address_match:
        data["address"] = address_match.group(1)
    cam_match = re.search(r"(?:CAM|common\s+area\s+maintenance)\s*\$?\s*(\d+\.?\d*)", text, re.IGNORECASE)
    if cam_match:
        data["cam_psf"] = float(cam_match.group(1))
    tax_match = re.search(r"(?:Taxes|Property Taxes)\s*\$?\s*(\d+\.?\d*)", text, re.IGNORECASE)
    if tax_match:
        data["taxes_psf"] = float(tax_match.group(1))
    return data

def extract_comps_from_pdf(file):
    """Attempt to extract comps table from PDF using pdfplumber."""
    comps = []
    try:
        with pdfplumber.open(file) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if len(row) >= 4 and re.search(r"\d", row[1]):
                            try:
                                comps.append({
                                    "address": row[0],
                                    "rent_psf": float(re.sub(r"[^\d.]", "", row[1])),
                                    "cam_psf": float(re.sub(r"[^\d.]", "", row[2])),
                                    "taxes_psf": float(re.sub(r"[^\d.]", "", row[3]))
                                })
                            except:
                                continue
        return pd.DataFrame(comps) if comps else None
    except Exception as e:
        st.warning(f"Failed to extract comps: {str(e)}")
        return None

# --- Financial Calculator ---
def analyze_deal(purchase_price, rent_psf, square_feet, expenses, loan_amount,
                 interest_rate, loan_term, cam_psf, taxes_psf):
    rent = rent_psf * square_feet / 12
    total_expenses = expenses + (cam_psf + taxes_psf) * square_feet / 12
    noi = (rent - total_expenses) * 12
    cap_rate = noi / purchase_price if purchase_price > 0 else 0
    monthly_payment = -npf.pmt(interest_rate / 12, loan_term * 12, loan_amount) if loan_amount > 0 else 0
    cash_flow = noi / 12 - monthly_payment
    coc_return = (cash_flow * 12) / (purchase_price - loan_amount) if purchase_price > loan_amount else 0
    irr = npf.irr([-purchase_price + loan_amount] + [cash_flow * 12] * loan_term)
    return {"Cap Rate": cap_rate, "Cash Flow": cash_flow, "CoC Return": coc_return, "IRR": irr, "NOI": noi}

# --- Access Control ---
access_code = st.text_input("Enter Access Code", type="password")
if access_code != "crebeta25":
    st.stop()

# --- Step 1: Mode Selection ---
mode = st.radio("How would you like to start?", ("Upload PDF (CoStar/Title)", "Manual Input"))

pdf_data = {"address": "", "property_type": "Office", "square_feet": 10000,
            "rent_psf": 28.0, "cam_psf": 5.0, "taxes_psf": 2.0}
comps_df = None

if mode == "Upload PDF (CoStar/Title)":
    uploaded_file = st.file_uploader("Upload PDF", type="pdf")
    if uploaded_file:
        with st.spinner("Extracting data from PDF..."):
            text = extract_pdf_text(uploaded_file)
            pdf_data = parse_summary_data(text)
            comps_df = extract_comps_from_pdf(uploaded_file)
        st.success("PDF data extracted!")
        st.write(f"**Rent:** ${pdf_data['rent_psf']:.2f}/sqft")
        if comps_df is not None:
            st.write("**Extracted Comps:**")
            st.dataframe(comps_df)

# --- Step 2: Property Details ---
st.markdown("### Property Details")
col1, col2 = st.columns(2)
with col1:
    address = st.text_input("Property Address", value=pdf_data.get("address", ""))
    property_type = st.selectbox("Property Type", ["Office", "Retail", "Industrial"], index=0)
with col2:
    square_feet = st.number_input("Square Footage", min_value=1000, value=pdf_data.get("square_feet", 10000))

# --- Step 3: Financial Inputs ---
st.markdown("### Financial Inputs")
col3, col4 = st.columns(2)
with col3:
    purchase_price = st.number_input("Purchase Price ($)", value=1000000)
    expenses = st.number_input("Monthly Expenses ($)", value=5000)
    rent_psf = st.number_input("Base Rent ($/sqft/year)", value=pdf_data.get("rent_psf", 28.0))
with col4:
    loan_amount = st.number_input("Loan Amount ($)", value=800000)
    interest_rate = st.number_input("Interest Rate (%)", value=5.0) / 100
    loan_term = st.number_input("Loan Term (years)", value=20)
    cam_psf = st.number_input("CAM ($/sqft/year)", value=pdf_data.get("cam_psf", 5.0))
    taxes_psf = st.number_input("Taxes ($/sqft/year)", value=pdf_data.get("taxes_psf", 2.0))

# --- Step 4: Analysis ---
if st.button("Analyze Deal"):
    conservative_rent_psf = rent_psf * 0.9
    base_rent_psf = rent_psf
    optimistic_rent_psf = rent_psf * 1.1

    scenarios = {
        "Conservative": analyze_deal(purchase_price, conservative_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term, cam_psf, taxes_psf),
        "Base": analyze_deal(purchase_price, base_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term, cam_psf, taxes_psf),
        "Optimistic": analyze_deal(purchase_price, optimistic_rent_psf, square_feet, expenses, loan_amount, interest_rate, loan_term, cam_psf, taxes_psf)
    }

    # Scenario results
    st.subheader("Scenario Analysis")
    cols = st.columns(3)
    for i, (name, result) in enumerate(scenarios.items()):
        with cols[i]:
            st.metric(f"{name} Cap Rate", f"{result['Cap Rate']:.2%}")
            st.metric("Cash Flow", f"${result['Cash Flow']:,.0f}/month")
            st.metric("NOI", f"${result['NOI']:,.0f}/year")
            st.metric("IRR", f"{result['IRR']:.2%}")

    # Benchmark Comparison from Comps
    if comps_df is not None:
        st.subheader("Benchmark Comparison (From PDF Comps)")
        avg_rent = comps_df["rent_psf"].mean()
        avg_cam = comps_df["cam_psf"].mean()
        avg_taxes = comps_df["taxes_psf"].mean()
        comparison_data = [
            {"Metric": "Rent ($/sqft)", "Your Deal": base_rent_psf, "Comps Avg": avg_rent,
             "Status": "Over" if base_rent_psf > avg_rent else "Under" if base_rent_psf < avg_rent else "Aligned"},
            {"Metric": "CAM ($/sqft)", "Your Deal": cam_psf, "Comps Avg": avg_cam,
             "Status": "Over" if cam_psf > avg_cam else "Under" if cam_psf < avg_cam else "Aligned"},
            {"Metric": "Taxes ($/sqft)", "Your Deal": taxes_psf, "Comps Avg": avg_taxes,
             "Status": "Over" if taxes_psf > avg_taxes else "Under" if taxes_psf < avg_taxes else "Aligned"}
        ]
        st.dataframe(pd.DataFrame(comparison_data))
