import os
import json
import random
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.stats import pearsonr

# Set aesthetic styles for charts
sns.set_theme(style="darkgrid")
plt.rcParams.update({
    'figure.facecolor': '#121212',
    'axes.facecolor': '#1e1e1e',
    'text.color': '#e0e0e0',
    'axes.labelcolor': '#e0e0e0',
    'xtick.color': '#b0b0b0',
    'ytick.color': '#b0b0b0',
    'grid.color': '#2a2a2a',
    'axes.edgecolor': '#2a2a2a'
})

DEFAULT_PROTOCOL_SCHEDULE = [
    { 'id': 'wake_prep', 'name': 'Wake & Prep', 'start': '07:00', 'end': '08:00', 'type': 'rest', 'format': 'Recovery' },
    { 'id': 'sql_block_1', 'name': 'SQL Focus 1', 'start': '08:00', 'end': '10:30', 'type': 'study', 'key': 'sql', 'format': 'Pomodoro' },
    { 'id': 'diffuse_break_1', 'name': 'Diffuse Break', 'start': '10:30', 'end': '11:00', 'type': 'rest', 'format': 'Diffuse Mode' },
    { 'id': 'german_block_1', 'name': 'German Active', 'start': '11:00', 'end': '13:00', 'type': 'study', 'key': 'german', 'format': 'Pomodoro' },
    { 'id': 'lunch', 'name': 'Lunch', 'start': '13:00', 'end': '14:00', 'type': 'rest', 'format': 'Recovery' },
    { 'id': 'sql_block_2', 'name': 'SQL Applied', 'start': '14:00', 'end': '16:30', 'type': 'study', 'key': 'sql', 'format': 'Flowtime' },
    { 'id': 'physical_reset', 'name': 'Physical Reset', 'start': '16:30', 'end': '18:00', 'type': 'rest', 'format': 'Recovery' },
    { 'id': 'german_block_2', 'name': 'German Immersion', 'start': '18:00', 'end': '20:00', 'type': 'study', 'key': 'german', 'format': 'Flowtime' },
    { 'id': 'dinner', 'name': 'Dinner', 'start': '20:00', 'end': '21:00', 'type': 'rest', 'format': 'Recovery' },
    { 'id': 'leisure', 'name': 'Leisure', 'start': '21:00', 'end': '23:00', 'type': 'rest', 'format': 'Recovery' }
]

def time_to_midnight_minutes(time_str):
    """
    Converts 'HH:MM' time string to minutes relative to midnight (same as JS engine).
    23:45 -> -15 mins
    00:30 -> +30 mins
    """
    if not time_str:
        return None
    try:
        parts = time_str.split(':')
        h, m = int(parts[0]), int(parts[1])
        mins = h * 60 + m
        return mins - 1440 if h >= 12 else mins
    except (ValueError, IndexError):
        return None

def calculate_wake_delay(target_str, actual_str):
    """
    Calculates wake delay in minutes (actual - target).
    """
    if not target_str or not actual_str:
        return None
    try:
        t_parts = target_str.split(':')
        a_parts = actual_str.split(':')
        t_mins = int(t_parts[0]) * 60 + int(t_parts[1])
        a_mins = int(a_parts[0]) * 60 + int(a_parts[1])
        return a_mins - t_mins
    except (ValueError, IndexError):
        return None

def generate_mock_data():
    """
    Generates 30 days of realistic mock logs to allow running the analysis out-of-the-box.
    Introduces correlation between late bedtime and wake delays, and study overruns.
    """
    print("No existing daily_logs.json found. Generating 30 days of mock study logs...")
    
    start_date = datetime.now() - timedelta(days=30)
    mock_logs = {}
    
    subjects = ['german', 'sql', 'python']
    
    # Base schedule blocks
    default_schedule = [
        {"id": "wake_prep", "name": "Wake & Prep", "type": "rest", "format": "Recovery", "start": "07:00", "end": "08:00"},
        {"id": "sql_block_1", "name": "SQL Focus 1", "type": "study", "key": "sql", "format": "Pomodoro", "start": "08:00", "end": "10:30"},
        {"id": "german_block_1", "name": "German Focus 1", "type": "study", "key": "german", "format": "Pomodoro", "start": "10:30", "end": "13:00"},
        {"id": "lunch", "name": "Rest & Nutrition", "type": "rest", "format": "Recovery", "start": "13:00", "end": "14:30"},
        {"id": "python_block_1", "name": "Python Focus 1", "type": "study", "key": "python", "format": "Flowtime", "start": "14:30", "end": "17:30"},
        {"id": "german_block_2", "name": "German Focus 2", "type": "study", "key": "german", "format": "Pomodoro", "start": "17:30", "end": "20:00"},
        {"id": "wind_down", "name": "Evening Reflection & Rest", "type": "rest", "format": "Recovery", "start": "20:00", "end": "23:00"}
    ]
    
    for i in range(31):
        current_day = start_date + timedelta(days=i)
        date_str = current_day.strftime("%Y-%m-%d")
        
        # Bedtime and wakeup correlation simulation
        # If sleep late -> wake up late
        sleep_late_chance = random.random()
        if sleep_late_chance > 0.7:  # 30% chance of sleeping late
            sleep_time = random.choice(["23:45", "00:15", "00:45", "01:15"])
            sleep_type = "late"
            sleep_reason = "Debugging Python code or browsing screens."
            # Wake delay will likely be positive (late)
            target_wake = "06:30"
            actual_wake = (datetime.strptime(target_wake, "%H:%M") + timedelta(minutes=random.randint(15, 75))).strftime("%H:%M")
        else:
            sleep_time = random.choice(["22:30", "22:45", "23:00"])
            sleep_type = "on-time"
            sleep_reason = "Maintained evening wind-down routine."
            target_wake = "06:30"
            actual_wake = (datetime.strptime(target_wake, "%H:%M") + timedelta(minutes=random.randint(-15, 10))).strftime("%H:%M")
            
        on_time_wake = actual_wake <= target_wake
        
        # Study minutes simulation
        # Introduce overrun correlation: if tech studies exceed target, German target is missed
        tech_overrun = random.random() > 0.6
        
        timer_logged = {}
        manual_credited = {}
        completed_blocks = ["wake_prep", "lunch", "wind_down"]
        session_details = {}
        
        # Base stats
        sql_mins = 150 if not tech_overrun else random.randint(180, 240)
        python_mins = 180 if not tech_overrun else random.randint(200, 300)
        
        # German minutes - drops if tech overruns
        german_mins = random.randint(180, 300) if not tech_overrun else random.randint(30, 120)
        german_failed = german_mins < 180 or tech_overrun
        
        # Populate blocks
        timer_logged["sql_block_1"] = sql_mins
        completed_blocks.append("sql_block_1")
        session_details["sql_block_1"] = {"goal_achieved": True, "notes": "Completed database querying routines."}
        
        timer_logged["python_block_1"] = python_mins
        completed_blocks.append("python_block_1")
        session_details["python_block_1"] = {"goal_achieved": True, "notes": "Built data pipeline features."}
        
        timer_logged["german_block_1"] = german_mins // 2
        timer_logged["german_block_2"] = german_mins - (german_mins // 2)
        
        if german_mins > 60:
            completed_blocks.append("german_block_1")
            session_details["german_block_1"] = {"goal_achieved": not german_failed, "notes": "Practiced vocabulary."}
        if german_mins > 180:
            completed_blocks.append("german_block_2")
            session_details["german_block_2"] = {"goal_achieved": True, "notes": "Completed listening comprehension."}
        else:
            session_details["german_block_2"] = {"goal_achieved": False, "notes": "Felt too exhausted after coding sessions."}
            
        mock_logs[date_str] = {
            "completed_blocks": completed_blocks,
            "manual_credited_mins": manual_credited,
            "timer_logged_mins": timer_logged,
            "session_details": session_details,
            "custom_schedule": default_schedule,
            "wake_up": {
                "target_time": target_wake,
                "actual_time": actual_wake,
                "on_time": on_time_wake,
                "reason": "Simulated alarm response." if on_time_wake else "Felt fatigued."
            },
            "sleep": {
                "actual_time": sleep_time,
                "timing_type": sleep_type,
                "reason": sleep_reason
            }
        }
        
    # Write to local file
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)
    with open(os.path.join(data_dir, 'daily_logs.json'), 'w') as f:
        json.dump(mock_logs, f, indent=2)
        
    print(f"Mock data created successfully at {os.path.join(data_dir, 'daily_logs.json')}\n")
    return mock_logs

def parse_logs_to_dataframe(logs_data):
    """
    Parses firestore log json structure into an aggregated Pandas DataFrame.
    """
    rows = []
    
    for date_str, log in logs_data.items():
        # Bedtime & wakeup calculations
        sleep_data = log.get('sleep') or {}
        bedtime_mins = time_to_midnight_minutes(sleep_data.get('actual_time'))
        
        wake_up = log.get('wake_up') or {}
        wake_delay = calculate_wake_delay(wake_up.get('target_time'), wake_up.get('actual_time'))
        
        # Initialize counts
        study_mins = {'german': 0, 'sql': 0, 'python': 0}
        german_failed = False
        
        # Scan schedule and map completed times
        schedule = log.get('custom_schedule')
        if not schedule:
            schedule = DEFAULT_PROTOCOL_SCHEDULE
            
        custom_subjects = log.get('custom_block_subjects') or {}
        timer_logged = log.get('timer_logged_mins') or {}
        manual_credited = log.get('manual_credited_mins') or {}
        session_details = log.get('session_details') or {}
        
        for block in schedule:
            if block.get('type') != 'study':
                continue
            
            block_id = block.get('id')
            subject_key = custom_subjects.get(block_id) or block.get('key')
            
            block_mins = timer_logged.get(block_id, 0) + manual_credited.get(block_id, 0)
            
            if subject_key in study_mins:
                study_mins[subject_key] += block_mins
                
                # Check for failure states on German blocks
                if subject_key == 'german':
                    details = session_details.get(block_id, {})
                    goal = details.get('goal_achieved')
                    if goal is False or goal == 'unattempted':
                        german_failed = True
                        
        rows.append({
            'date': date_str,
            'bedtime_minutes': bedtime_mins,
            'wake_delay_minutes': wake_delay,
            'german_mins': study_mins['german'],
            'sql_mins': study_mins['sql'],
            'python_mins': study_mins['python'],
            'tech_mins': study_mins['sql'] + study_mins['python'],
            'german_failed': german_failed
        })
        
    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    return df

def analyze_correlation(df):
    """
    Calculates Pearson r correlation between Bedtime on Day N and Wake Delay on Day N+1.
    Requires days to be consecutive.
    """
    x_bedtime = []
    y_wake_delay = []
    
    for i in range(len(df) - 1):
        day_n = df.iloc[i]
        day_n_plus_1 = df.iloc[i + 1]
        
        # Check if consecutive dates
        time_diff = day_n_plus_1['date'] - day_n['date']
        if time_diff.days == 1:
            if pd.notna(day_n['bedtime_minutes']) and pd.notna(day_n_plus_1['wake_delay_minutes']):
                x_bedtime.append(day_n['bedtime_minutes'])
                y_wake_delay.append(day_n_plus_1['wake_delay_minutes'])
                
    if len(x_bedtime) < 3:
        return None, None, [], []
        
    r_coef, p_val = pearsonr(x_bedtime, y_wake_delay)
    return r_coef, p_val, x_bedtime, y_wake_delay

def generate_visualizations(df, r_coef, p_val, corr_x, corr_y):
    """
    Creates and saves analysis plots under analytics/plots/
    """
    plots_dir = os.path.join(os.path.dirname(__file__), 'plots')
    os.makedirs(plots_dir, exist_ok=True)
    
    # Colors matching a sleek dark theme
    accent_color = "#38bdf8"  # Neon blue/cyan
    secondary_color = "#a855f7"  # Purple
    coral_color = "#f43f5e"  # Soft rose/coral
    
    # Plot 1: Bedtime vs Wakeup Delay Scatter and Regplot
    plt.figure(figsize=(8, 5.5))
    if r_coef is not None:
        corr_df = pd.DataFrame({'Bedtime (Mins from Midnight)': corr_x, 'Wake Delay (Mins)': corr_y})
        sns.regplot(
            x='Bedtime (Mins from Midnight)', 
            y='Wake Delay (Mins)', 
            data=corr_df,
            color=accent_color,
            scatter_kws={'alpha':0.6, 's':80, 'edgecolor':'#ffffff'},
            line_kws={'color': coral_color, 'linewidth': 2}
        )
        # Annotate statistical metrics
        plt.title("Circadian Impact: Bedtime (Day N) vs. Wake Delay (Day N+1)", fontsize=14, pad=15, weight='bold')
        plt.xlabel("Bedtime (Minutes relative to Midnight)", fontsize=11, labelpad=10)
        plt.ylabel("Wake Delay (Minutes late/early)", fontsize=11, labelpad=10)
        
        textstr = f"Pearson $r$ = {r_coef:.2f}\n$p$-value = {p_val:.4f}\n"
        if abs(r_coef) >= 0.5:
            textstr += "Correlation Strength: Strong"
        elif abs(r_coef) >= 0.3:
            textstr += "Correlation Strength: Moderate"
        else:
            textstr += "Correlation Strength: Weak"
            
        plt.gca().text(0.05, 0.95, textstr, transform=plt.gca().transAxes, fontsize=10,
                    verticalalignment='top', bbox=dict(boxstyle='round,pad=0.5', facecolor='#1e1e1e', edgecolor='#2a2a2a', alpha=0.9))
    else:
        plt.text(0.5, 0.5, "Insufficient consecutive days to compute correlation.", 
                 ha='center', va='center', fontsize=12)
        
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, 'bedtime_wake_correlation.png'), dpi=150)
    plt.close()
    
    # Plot 2: Study Volatility (Boxplot and Bar Plot comparison)
    plt.figure(figsize=(9, 5))
    study_cols = ['german_mins', 'sql_mins', 'python_mins']
    melted_df = df.melt(id_vars=['date'], value_vars=study_cols, 
                        var_name='Subject', value_name='Minutes')
    melted_df['Subject'] = melted_df['Subject'].map({
        'german_mins': 'German',
        'sql_mins': 'SQL',
        'python_mins': 'Python'
    })
    
    palette = {'German': '#10b981', 'SQL': '#f59e0b', 'Python': '#3b82f6'}
    
    sns.boxplot(
        x='Subject', 
        y='Minutes', 
        data=melted_df, 
        hue='Subject',
        palette=palette,
        legend=False,
        boxprops=dict(alpha=0.75),
        flierprops=dict(markerfacecolor='#f43f5e', markeredgecolor='none', alpha=0.6)
    )
    plt.title("Study Consistency: Volatility Distribution by Subject", fontsize=14, pad=15, weight='bold')
    plt.xlabel("Subject Domain", fontsize=11, labelpad=10)
    plt.ylabel("Daily Study Duration (Minutes)", fontsize=11, labelpad=10)
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, 'study_volatility.png'), dpi=150)
    plt.close()
    
    # Plot 3: 7-Day Moving Averages (Trend Tracking)
    plt.figure(figsize=(10, 5.5))
    df_trends = df.copy()
    for col in study_cols:
        subj_name = col.split('_')[0].capitalize()
        df_trends[f'{subj_name} (7-Day MA)'] = df_trends[col].rolling(window=7, min_periods=1).mean()
        
    plt.plot(df_trends['date'], df_trends['German (7-Day MA)'], label='German', color='#10b981', linewidth=2.5)
    plt.plot(df_trends['date'], df_trends['Sql (7-Day MA)'], label='SQL', color='#f59e0b', linewidth=2.5)
    plt.plot(df_trends['date'], df_trends['Python (7-Day MA)'], label='Python', color='#3b82f6', linewidth=2.5)
    
    # Add goal target lines
    plt.axhline(y=300, color='#10b981', linestyle='--', alpha=0.3, label='German Target (300m)')
    plt.axhline(y=240, color='#3b82f6', linestyle='--', alpha=0.3, label='Tech Target (240m)')
    
    plt.title("Weekly Trends: 7-Day Moving Averages vs. Targets", fontsize=14, pad=15, weight='bold')
    plt.xlabel("Date", fontsize=11, labelpad=10)
    plt.ylabel("Rolling Average Daily Focus (Minutes)", fontsize=11, labelpad=10)
    plt.legend(facecolor='#1e1e1e', edgecolor='#2a2a2a')
    plt.gcf().autofmt_xdate()
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, 'daily_trends.png'), dpi=150)
    plt.close()
    
    print(f"Visualizations saved to plots directory: {os.path.abspath(plots_dir)}")

def main():
    json_path = os.path.join(os.path.dirname(__file__), 'data', 'daily_logs.json')
    
    # Check if logs exist, if not generate mock data
    if not os.path.exists(json_path):
        logs_data = generate_mock_data()
    else:
        print(f"Loading logs from local file: {json_path}")
        with open(json_path, 'r', encoding='utf-8') as f:
            logs_data = json.load(f)
            
    df = parse_logs_to_dataframe(logs_data)
    print(f"Parsed {len(df)} days of study tracking history.")
    
    # 1. Pearson Correlation Analysis
    r_coef, p_val, corr_x, corr_y = analyze_correlation(df)
    
    print("\n" + "="*50)
    print("           CIRCADIAN STATISTICAL REPORT          ")
    print("="*50)
    if r_coef is not None:
        print(f"Pearson Correlation Coefficient (r) : {r_coef:+.4f}")
        print(f"Statistical Significance (p-value)  : {p_val:.6f}")
        if p_val < 0.05:
            print("Verdict: STATISTICALLY SIGNIFICANT. Your bedtime on Day N directly impacts")
            print("         your schedule offset (wake delay) on Day N+1.")
        else:
            print("Verdict: Not statistically significant at the 5% level. Keep tracking!")
    else:
        print("Not enough consecutive data pairs to run Pearson correlation.")
        
    # 2. Volatility Analysis
    print("\n" + "="*50)
    print("         STUDY VOLUME & VOLATILITY PROFILE        ")
    print("="*50)
    for subj in ['german', 'sql', 'python']:
        col = f"{subj}_mins"
        mean_val = df[col].mean()
        std_val = df[col].std()
        
        # Categorize stability (matching JS thresholds)
        if std_val < 15:
            stability = "Machine-Like Consistency"
        elif std_val < 45:
            stability = "Healthy Adaptability"
        else:
            stability = "Highly Unstable / Reactive Routine"
            
        print(f"{subj.upper():<8}: Mean = {mean_val:5.1f} min | StdDev = {std_val:5.1f} min ({stability})")
        
    # 3. Transition Failure Probability (Tech overruns -> German failure)
    print("\n" + "="*50)
    print("             BEHAVIORAL INTERFERENCE            ")
    print("="*50)
    # Target tech focus is 240 mins (SQL + Python)
    tech_overruns_df = df[df['tech_mins'] >= 240]
    num_overruns = len(tech_overruns_df)
    
    if num_overruns > 0:
        failed_german_days = len(tech_overruns_df[tech_overruns_df['german_failed'] == True])
        prob = (failed_german_days / num_overruns) * 100
        print(f"Days exceeding Tech focus target (>= 240m) : {num_overruns}")
        print(f"Days German target failed during overrun    : {failed_german_days}")
        print(f"Conditional Probability P(German Fail | Tech Overrun) : {prob:.1f}%")
        print("\nInterpretation:")
        if prob > 50:
            print("WARNING: High risk of subject interference! Coding sessions overrunning")
            print("         exerts high mental fatigue, directly leading to German targets failing.")
        else:
            print("You are managing the dual-subject schedule balance effectively.")
    else:
        print("No days recorded where Tech study minutes exceeded 240m.")
    print("="*50 + "\n")
    
    # Generate charts
    generate_visualizations(df, r_coef, p_val, corr_x, corr_y)

if __name__ == "__main__":
    main()
