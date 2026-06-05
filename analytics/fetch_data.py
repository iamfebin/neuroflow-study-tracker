import os
import json
import argparse
import firebase_admin
from firebase_admin import credentials, firestore

def setup_firebase():
    """
    Initializes the Firebase Admin SDK using serviceAccountKey.json.
    """
    cred_path = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
    
    if not os.path.exists(cred_path):
        print("\n" + "="*80)
        print("ERROR: serviceAccountKey.json NOT FOUND!")
        print("="*80)
        print("To fetch real-time study logs from Firestore, you need a Firebase Service Account Key.")
        print("\nHow to get it:")
        print("1. Go to the Firebase Console: https://console.firebase.google.com/")
        print("2. Select your NeuroFlow project.")
        print("3. Click the gear icon (Project Settings) > 'Project settings'.")
        print("4. Go to the 'Service accounts' tab.")
        print("5. Click the 'Generate new private key' button at the bottom.")
        print("6. Save the downloaded JSON file as 'serviceAccountKey.json' in this folder:")
        print(f"   {os.path.abspath(os.path.dirname(__file__))}/")
        print("="*80 + "\n")
        return None

    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"Error initializing Firebase Admin SDK: {e}")
        return None

def fetch_logs(db, user_id):
    """
    Queries the Firestore collection for the specified user and dumps all documents.
    """
    print(f"Connecting to Firestore and fetching logs for user: {user_id}...")
    
    # Path format in Firestore: neuroflow-minimal/{userId}/daily_logs/{YYYY-MM-DD}
    collection_ref = db.collection('neuroflow-minimal').document(user_id).collection('daily_logs')
    
    try:
        docs = collection_ref.stream()
        logs_data = {}
        count = 0
        for doc in docs:
            logs_data[doc.id] = doc.to_dict()
            count += 1
            
        print(f"Successfully downloaded {count} daily logs.")
        return logs_data
    except Exception as e:
        print(f"Error streaming logs from Firestore: {e}")
        print("Check if your serviceAccountKey.json corresponds to the correct project and has Firestore permissions.")
        return None

def save_logs_to_file(logs_data):
    """
    Saves the fetched logs to analytics/data/daily_logs.json.
    """
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    file_path = os.path.join(data_dir, 'daily_logs.json')
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(logs_data, f, indent=2, ensure_ascii=False)
        print(f"Logs successfully saved to local file: {os.path.abspath(file_path)}")
    except Exception as e:
        print(f"Error saving logs to file: {e}")

def main():
    parser = argparse.ArgumentParser(description="Fetch NeuroFlow daily study logs from Firestore.")
    parser.add_argument(
        "--user-id", 
        type=str, 
        help="The UID of the user to fetch logs for. If not provided, you will be prompted."
    )
    args = parser.parse_args()

    user_id = args.user_id
    if not user_id:
        user_id = input("Enter your Firebase User ID (UID): ").strip()
        if not user_id:
            print("User ID is required to fetch logs. Exiting.")
            return

    db = setup_firebase()
    if db is None:
        return

    logs_data = fetch_logs(db, user_id)
    if logs_data:
        save_logs_to_file(logs_data)

if __name__ == "__main__":
    main()
