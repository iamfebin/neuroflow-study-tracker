# NeuroFlow Analytics Companion

This is a Python-based data science and statistical analytics tool designed to process, analyze, and visualize study habit records from the NeuroFlow application. 

It replicates and extends the statistical models used in the web application (using Pandas, SciPy, Matplotlib, and Seaborn) to provide detailed summaries and publication-quality charts.

---

## Features

1. **Circadian Impact Correlation**: Calculates the Pearson correlation coefficient ($r$ and $p$-value) between bedtimes on Day N and wake delays (waking up early/late) on Day N+1.
2. **Study Volatility Profile**: Measures consistency (mean and standard deviation) of study sessions for German, SQL, and Python.
3. **Behavioral Interference (Overrun Analysis)**: Computes the conditional probability that the German language goal will fail when technical study targets (SQL + Python) are exceeded.
4. **Data Visualizations**: Generates visual representations of study habits and circadian offsets, outputting them directly as image plots.

---

## Directory Structure

```
analytics/
├── data/
│   └── daily_logs.json               # Downloaded database logs (gitignored)
├── plots/
│   ├── bedtime_wake_correlation.png  # Circadian regression plot (gitignored)
│   ├── study_volatility.png          # Boxplot comparing focus times (gitignored)
│   └── daily_trends.png              # Line chart tracking weekly trends (gitignored)
├── fetch_data.py                     # Script to pull data from Firestore
├── analysis.py                      # Main statistical analysis & graphing script
├── requirements.txt                  # Python dependencies
└── README.md                         # Setup & guide (this file)
```

---

## Installation & Setup

Ensure you have Python 3.8+ installed.

### 1. Install Dependencies
Initialize a virtual environment (optional) and install the packages:
```bash
pip install -r requirements.txt
```

### 2. Run the Analysis (Instant Mock Demo)
If you do not have Firestore credentials yet, you can run the analysis immediately using generated mock data. The analysis script will automatically generate 30 days of realistic study habits:
```bash
python analysis.py
```
This runs the statistical pipeline and saves sample plots into the `plots/` directory.

### 3. Fetching Your Real-Time Data from Firestore
To analyze your real NeuroFlow study history, configure the Firebase Admin SDK:

1. Go to the **[Firebase Console](https://console.firebase.google.com/)**.
2. Select your NeuroFlow project.
3. Click the gear icon in the sidebar (Project Settings) > **Project settings**.
4. Navigate to the **Service accounts** tab.
5. Click the **Generate new private key** button.
6. A JSON file will download. Save this file as **`serviceAccountKey.json`** directly inside the `analytics/` folder.
7. Run the fetch command:
   ```bash
   python fetch_data.py
   ```
8. The script will ask for your Firebase User ID (UID). You can find this in the Firebase Console under **Authentication** > **Users**.
9. Once successfully downloaded, run `python analysis.py` to analyze your personal study statistics.

---

## Generated Visualizations

* **`plots/bedtime_wake_correlation.png`**: Scatter plot with a linear regression line tracking bedtime vs. wake delay. Includes statistical overlays representing Pearson $r$ and its $p$-value.
* **`plots/study_volatility.png`**: Boxplots showing the median, interquartile range (IQR), and outliers of study volume across subjects.
* **`plots/daily_trends.png`**: Time-series chart showing 7-day moving averages of study blocks compared against study target lines.
