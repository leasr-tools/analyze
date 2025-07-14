# MVP: CRE Deal Analyzer App (Backend with Streamlit + Snowflake + Auth0)

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import numpy_financial as npf

# --- Page Config for Full Width
st.set_page_config(layout="wide")

# --- Global Styling
st.markdown("""
    <style>
    body, div, input, select, textarea, span, label, h1, h2, h3, h4, h5, h6, p {
        font-family: Helvetica, Arial, sans-serif !important;
    }
    .section-header {
        padding: 1rem 0;
        border-bottom: 1px solid #eee;
    }
    .scenario-box {
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 1rem;
        background: #fafafa;
        margin-bottom: 1rem;
    }
    .conservative-header {
        color: #7b68ee;
    }
    .basecase-header {
        color: #3cb371;
    }
    .optimistic-header {
        color: #ff8c00;
    }
    .input-container {
        background: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }
    .metric-block {
        background: #ffffff;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        margin-bottom: 0.5rem;
    }
    .styled-section {
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        padding: 1.5rem;
        margin-bottom: 2rem;
        background-color: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .styled-subsection {
        margin-top: 1rem;
        margin-bottom: 2rem;
    }
    .subsection-label {
        font-weight: bold;
        font-size: 1.2rem;
        margin-bottom: 0.5rem;
        color: #333333;
    }
    .styled-table-section {
        margin-top: 2rem;
        padding: 1rem 1.5rem;
        border: 1px solid #ccc;
        border-radius: 8px;
        background-color: #f9f9f9;
    }
    .chart-section-title {
        font-weight: bold;
        font-size: 1.4rem;
        margin: 1rem 0 0.5rem;
    }
    </style>
""", unsafe_allow_html=True)

# --- Auth0 Placeholder
st.sidebar.title("Login")
st.sidebar.success("Logged in as demo.user@example.com")

# --- Page Title
st.markdown("""
<div class="section-header">
<h1 style="font-family: Helvetica, Arial, sans-serif">Leasr Analyze: Commercial Real Estate Deal Analyzer</h1>
<p style="font-family: Helvetica, Arial, sans-serif">Quickly evaluate your deal's performance with side-by-side scenarios.</p>
</div>
""", unsafe_allow_html=True)

# Format functions
def format_dollar(val):
    return f"${val:,.0f}"

def format_percent(val):
    return f"{val:.1f}%"

def format_tooltip(val):
    return f"${val/1000:,.0f}k"

# Function to perform deal analysis

def analyze_deal(purchase_price, rent_income, expenses, down_payment_pct, loan_interest, loan_term, appreciation_rate, hold_period, io_years):
    down_payment = purchase_price * (down_payment_pct / 100)
    loan_amount = purchase_price - down_payment
    monthly_rate = loan_interest / 100 / 12
    num_payments = loan_term * 12

    pni_monthly = loan_amount * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)

    noi = (rent_income - expenses) * 12
    cap_rate = (noi / purchase_price) * 100

    cash_flows = [-down_payment]
    balance = loan_amount
    schedule = []

    for year in range(1, hold_period + 1):
        interest_paid = 0
        principal_paid = 0
        for month in range(12):
            if year <= io_years:
                interest = balance * monthly_rate
                payment = interest
                principal = 0
            else:
                interest = balance * monthly_rate
                payment = pni_monthly
                principal = payment - interest
                balance -= principal
            interest_paid += interest
            principal_paid += principal
        year_debt = interest_paid + principal_paid
        cash_flow = noi - year_debt
        property_value = purchase_price * ((1 + appreciation_rate / 100) ** year)
        equity = property_value - balance
        total_profit = equity + cash_flow * year - down_payment
        dcr = noi / year_debt if year_debt != 0 else np.nan
        roi = total_profit / down_payment * 100

        schedule.append({
            "Year": year,
            "Property Value": property_value,
            "Remaining Balance": balance,
            "Equity": equity,
            "NOI": noi,
            "Cash Flow": cash_flow,
            "Interest Paid": interest_paid,
            "Principal Paid": principal_paid,
            "Profit": total_profit,
            "ROI": roi,
            "DCR": dcr
        })
        cash_flows.append(cash_flow)

    irr = npf.irr(cash_flows)
    amort_df = pd.DataFrame(schedule)
    return cash_flow, (cash_flow * hold_period) / down_payment * 100, property_value, equity, cap_rate, irr * 100, amort_df

# --- Input Section
st.markdown("<div class='section-header'><h2>Inputs</h2></div>", unsafe_allow_html=True)
hold_period = st.slider("Hold Period (years)", 1, 30, 10)
io_years = st.slider("Interest-Only Period (years)", 0, 10, 0)

purchase_price = 1000000
expenses = 4000
loan_term = 30

scenarios = [
    ("Conservative", 9000, 30, 5.5, 2.0, "cons"),
    ("Base Case", 10000, 25, 5.0, 3.0, "base"),
    ("Optimistic", 11000, 20, 4.5, 4.0, "opt")
]

col1, col2, col3 = st.columns(3)
results = {}

for col, (label, rent_income, dp_pct, rate, app_rate, key_prefix) in zip([col1, col2, col3], scenarios):
    with col:
        color_class = "conservative-header" if label == "Conservative" else "basecase-header" if label == "Base Case" else "optimistic-header"
        st.markdown(f"<div class='styled-section styled-subsection'><h3 class='{color_class}'>{label}</h3>", unsafe_allow_html=True)
        rent_income = st.number_input(f"Rent - {label}", value=rent_income, step=500, key=f"{key_prefix}_rent")
        down_payment_pct = st.slider("Down %", 0, 100, dp_pct, key=f"{key_prefix}_down")
        loan_interest = st.number_input("Rate %", value=rate, key=f"{key_prefix}_rate")
        appreciation_rate = st.slider("Appreciation %", 0.0, 10.0, app_rate, key=f"{key_prefix}_appreciation")

        cash_flow, coc_return, future_value, equity_gain, cap_rate, irr, amort_df = analyze_deal(
            purchase_price, rent_income, expenses, down_payment_pct, loan_interest, loan_term, appreciation_rate, hold_period, io_years)

        st.metric("Cap Rate", format_percent(cap_rate))
        st.metric(f"Cash Flow in Year {hold_period}", format_dollar(cash_flow))
        st.metric("CoC Return", format_percent(coc_return))
        st.metric(f"IRR ({hold_period} yrs)", format_percent(irr))
        st.metric(f"Value in {hold_period} yrs", format_dollar(future_value))
        st.metric("Equity Gain", format_dollar(equity_gain))

        amort_df_formatted = amort_df.copy()
        dollar_cols = ["Property Value", "Remaining Balance", "Equity", "NOI", "Cash Flow", "Interest Paid", "Principal Paid", "Profit"]
        percent_cols = ["ROI"]

        for col_ in dollar_cols:
            amort_df_formatted[col_] = amort_df_formatted[col_].apply(lambda x: f"${x:,.0f}")
        for col_ in percent_cols:
            amort_df_formatted[col_] = amort_df_formatted[col_].apply(lambda x: f"{x:.1f}%")
        amort_df_formatted["DCR"] = amort_df_formatted["DCR"].apply(lambda x: f"{x:.2f}" if not pd.isna(x) else "")

        results[label] = (amort_df_formatted, cash_flow, amort_df)
        st.markdown("</div>", unsafe_allow_html=True)

# --- Amortization Tables ---
st.markdown("<div class='section-header'><h2>Amortization Schedule</h2></div>", unsafe_allow_html=True)
for label in ["Conservative", "Base Case", "Optimistic"]:
    st.markdown(f"### {label}")
    st.dataframe(results[label][0], use_container_width=True)

# --- Donut Charts ---
st.markdown("<div class='section-header'><h2>Ratios</h2></div>", unsafe_allow_html=True)
donut_cols = st.columns(3)
colors = ["#7b68ee", "#3cb371", "#ff8c00"]
labels = ["Interest", "Principal", "Cash Flow"]
legend_colors = {"Interest": "#7b68ee", "Principal": "#3cb371", "Cash Flow": "#ff8c00"}

for col, (label, color) in zip(donut_cols, zip(["Conservative", "Base Case", "Optimistic"], colors)):
    with col:
        st.markdown(f"<div class='chart-section-title'>{label}</div>", unsafe_allow_html=True)  # <<< Add this line
        df = results[label][2]
        latest = df.iloc[-1]
        values = [latest["Interest Paid"], latest["Principal Paid"], latest["Cash Flow"]]
        fig = go.Figure(data=[go.Pie(
            labels=labels,
            values=values,
            hole=0.8,
            marker=dict(colors=[legend_colors[lbl] for lbl in labels]),
            textinfo='label+percent',
            textposition='outside',
            hovertemplate="%{label}: %{value:$,.0f}<extra></extra>"
        )])
        fig.update_layout(showlegend=False, margin=dict(t=0, b=0, l=0, r=0))
        st.plotly_chart(fig, use_container_width=True)
      
legend_html = "<div style='text-align:center; margin-top: -20px;'>" + " ".join([f"<span style='color:{legend_colors[k]}; font-weight:bold;'>&#9632; {k}</span>" for k in labels]) + "</div>"
st.markdown(legend_html, unsafe_allow_html=True)

# --- Time Series ---
st.markdown("<div class='section-header'><h2>Time Series</h2></div>", unsafe_allow_html=True)
time_cols = st.columns(3)
trend_labels = ["Equity", "Cash Flow", "Profit"]
trend_colors = ["#7b68ee", "#3cb371", "#ff8c00"]

for col, label in zip(time_cols, ["Conservative", "Base Case", "Optimistic"]):
    df = results[label][2]
    fig = go.Figure()
    for name, color in zip(trend_labels, trend_colors):
        fig.add_trace(go.Scatter(x=df["Year"], y=df[name], mode='lines+markers', name=name, line=dict(color=color)))
    fig.update_layout(
        title=label,
        margin=dict(t=30, b=30, l=10, r=10),
        xaxis_title="Year",
        yaxis_title="Amount ($)",
        hoverlabel=dict(namelength=-1, bgcolor="white", font_size=13)
    )
    fig.update_traces(hovertemplate='%{y:$,.0f}')
    col.plotly_chart(fig, use_container_width=True)

legend_html2 = "<div style='text-align:center; margin-top: -20px;'>" + " ".join([f"<span style='color:{c}; font-weight:bold;'>&#9632; {l}</span>" for l, c in zip(trend_labels, trend_colors)]) + "</div>"
st.markdown(legend_html2, unsafe_allow_html=True)
