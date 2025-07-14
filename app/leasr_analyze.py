# MVP: CRE Deal Analyzer App (Backend with Streamlit + Snowflake + Auth0)

import streamlit as st
import pandas as pd
import numpy as np

# --- Auth0 Placeholder (actual implementation needs Auth0 SDK or Streamlit Auth wrapper)
# This is a placeholder login section.
st.sidebar.title("Login")
st.sidebar.success("Logged in as demo.user@example.com")  # Replace with real Auth0 flow

# --- Page Title
st.title("Leasr Analyze: Commercial Real Estate Deal Analyzer")
st.write("Quickly evaluate your deal's performance with side-by-side scenarios.")

# --- Scenario Tabs
tab1, tab2, tab3 = st.tabs(["Base Case", "Optimistic", "Conservative"])

# Function to perform deal analysis
def analyze_deal(purchase_price, rent_income, expenses, down_payment_pct, loan_interest, loan_term, appreciation_rate, hold_period):
    down_payment = purchase_price * (down_payment_pct / 100)
    loan_amount = purchase_price - down_payment
    monthly_rate = loan_interest / 100 / 12
    num_payments = loan_term * 12
    monthly_debt_service = loan_amount * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)

    noi = (rent_income - expenses) * 12
    annual_debt = monthly_debt_service * 12
    cash_flow = noi - annual_debt
    coc_return = (cash_flow / down_payment) * 100

    future_value = purchase_price * ((1 + appreciation_rate / 100) ** hold_period)
    equity_gain = future_value - loan_amount

    return cash_flow, coc_return, future_value, equity_gain

# Shared input defaults
purchase_price = 1000000
expenses = 4000
loan_term = 30
hold_period = 10

# --- Base Case Tab
with tab1:
    st.subheader("Base Case Inputs")
    rent_income = st.number_input("Monthly Rent Income ($) - Base", value=10000, step=500, key="base_rent")
    down_payment_pct = st.slider("Down Payment (%)", 0, 100, 25, key="base_down")
    loan_interest = st.number_input("Loan Interest Rate (%)", value=5.0, key="base_rate")
    appreciation_rate = st.slider("Annual Appreciation Rate (%)", 0.0, 10.0, 3.0, key="base_appreciation")

    if st.button("Analyze Base Case"):
        cash_flow, coc_return, future_value, equity_gain = analyze_deal(
            purchase_price, rent_income, expenses, down_payment_pct, loan_interest, loan_term, appreciation_rate, hold_period)

        st.metric("Annual Cash Flow", f"${cash_flow:,.0f}")
        st.metric("Cash-on-Cash Return", f"{coc_return:.2f}%")
        st.metric(f"Estimated Property Value in {hold_period} yrs", f"${future_value:,.0f}")
        st.metric("Projected Equity Gain", f"${equity_gain:,.0f}")

# --- Optimistic Case Tab
with tab2:
    st.subheader("Optimistic Case Inputs")
    rent_income = st.number_input("Monthly Rent Income ($) - Optimistic", value=11000, step=500, key="opt_rent")
    down_payment_pct = st.slider("Down Payment (%)", 0, 100, 20, key="opt_down")
    loan_interest = st.number_input("Loan Interest Rate (%)", value=4.5, key="opt_rate")
    appreciation_rate = st.slider("Annual Appreciation Rate (%)", 0.0, 10.0, 4.0, key="opt_appreciation")

    if st.button("Analyze Optimistic Case"):
        cash_flow, coc_return, future_value, equity_gain = analyze_deal(
            purchase_price, rent_income, expenses, down_payment_pct, loan_interest, loan_term, appreciation_rate, hold_period)

        st.metric("Annual Cash Flow", f"${cash_flow:,.0f}")
        st.metric("Cash-on-Cash Return", f"{coc_return:.2f}%")
        st.metric(f"Estimated Property Value in {hold_period} yrs", f"${future_value:,.0f}")
        st.metric("Projected Equity Gain", f"${equity_gain:,.0f}")

# --- Conservative Case Tab
with tab3:
    st.subheader("Conservative Case Inputs")
    rent_income = st.number_input("Monthly Rent Income ($) - Conservative", value=9000, step=500, key="cons_rent")
    down_payment_pct = st.slider("Down Payment (%)", 0, 100, 30, key="cons_down")
    loan_interest = st.number_input("Loan Interest Rate (%)", value=5.5, key="cons_rate")
    appreciation_rate = st.slider("Annual Appreciation Rate (%)", 0.0, 10.0, 2.0, key="cons_appreciation")

    if st.button("Analyze Conservative Case"):
        cash_flow, coc_return, future_value, equity_gain = analyze_deal(
            purchase_price, rent_income, expenses, down_payment_pct, loan_interest, loan_term, appreciation_rate, hold_period)

        st.metric("Annual Cash Flow", f"${cash_flow:,.0f}")
        st.metric("Cash-on-Cash Return", f"{coc_return:.2f}%")
        st.metric(f"Estimated Property Value in {hold_period} yrs", f"${future_value:,.0f}")
        st.metric("Projected Equity Gain", f"${equity_gain:,.0f}")
