import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import CSVLogger # <--- NEW TOOL

# --- CONFIGURATION ---
CSV_FILE_PATH = r'C:\Users\nirad\Downloads\Clima_Route\AI_Model\WeatherDataset.csv'
MODEL_SAVE_PATH = 'rainfall_model.keras'
SCALER_SAVE_PATH = 'scaler.gz'
LOG_FILE = 'training_log.csv' # <--- Where we save the history

FEATURE_COLS = ['temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 
                'surface_pressure', 'cloud_cover', 'wind_speed_10m', 
                'hour', 'month']
TARGET_COL = 'rainfall'

def load_and_process_data():
    print("Loading dataset...")
    df = pd.read_csv(CSV_FILE_PATH, parse_dates=['time'])
    df = df.sort_values(by='time')
    
    df['hour'] = df['time'].dt.hour
    df['month'] = df['time'].dt.month
    df.set_index('time', inplace=True)
    
    df = df[df[TARGET_COL].isin([0, 1, 2])]
    
    X = df[FEATURE_COLS].values
    y = df[TARGET_COL].values
    
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)
    
    print(f"Saving scaler to {SCALER_SAVE_PATH}...")
    joblib.dump(scaler, SCALER_SAVE_PATH)
    
    return X_scaled, y

def create_sequences(X_scaled, y, look_back=24):
    print(f"\n--- Creating Sequences ---")
    X_seq, y_seq = [], []
    for i in range(look_back, len(X_scaled)):
        window = X_scaled[i-look_back:i]
        target = y[i]
        X_seq.append(window)
        y_seq.append(target)
    return np.array(X_seq), np.array(y_seq)

def build_lstm_model(input_shape):
    print("\n--- Building LSTM Architecture ---")
    model = Sequential()
    
    # Robust Architecture
    model.add(LSTM(100, input_shape=input_shape, return_sequences=True))
    model.add(Dropout(0.3))
    model.add(LSTM(50, return_sequences=False))
    model.add(Dropout(0.3))
    
    model.add(Dense(32, activation='relu'))
    model.add(Dense(3, activation='softmax'))
    
    model.compile(optimizer='adam', 
                  loss='sparse_categorical_crossentropy', 
                  metrics=['accuracy'])
    
    return model

if __name__ == "__main__":
    X_scaled, y = load_and_process_data()
    X_seq, y_seq = create_sequences(X_scaled, y, look_back=24)
    
    X_train, X_test, y_train, y_test = train_test_split(X_seq, y_seq, test_size=0.2, shuffle=False)
    
    # Calculate Weights
    class_weights = compute_class_weight(class_weight='balanced', classes=np.unique(y_train), y=y_train)
    class_weight_dict = dict(enumerate(class_weights))
    
    model = build_lstm_model((X_train.shape[1], X_train.shape[2]))
    
    # --- TRAINING WITH LOGGING ---
    print("\n--- Starting Deep Training ---")
    
    # This 'callback' saves the accuracy to a file every epoch
    csv_logger = CSVLogger(LOG_FILE, append=False)
    
    model.fit(X_train, y_train, 
              epochs=10, 
              batch_size=1024, 
              validation_data=(X_test, y_test),
              class_weight=class_weight_dict,
              callbacks=[csv_logger]) # <--- We added the logger here
    
    print(f"\n--- Saving Model to {MODEL_SAVE_PATH} ---")
    model.save(MODEL_SAVE_PATH)
    print("Training Complete. Logs saved to 'training_log.csv'.")
    