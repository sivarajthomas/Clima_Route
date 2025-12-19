import pandas as pd
import matplotlib.pyplot as plt

# --- CONFIGURATION ---
LOG_FILE = r"C:\Users\magas\Desktop\Weather _pred_DL\AI_Model\training_log.csv"

def plot_performance():
    print("Reading training logs...")
    try:
        # Read the CSV file created by the training script
        data = pd.read_csv(LOG_FILE)
    except FileNotFoundError:
        print("Error: Could not find 'training_log.csv'. Did you run train_model.py first?")
        return

    epochs = range(1, len(data) + 1)
    
    # Create a nice wide figure
    plt.figure(figsize=(14, 6))
    
    # --- GRAPH 1: ACCURACY ---
    plt.subplot(1, 2, 1)
    plt.plot(epochs, data['accuracy'], label='Training Accuracy', color='blue', linewidth=2)
    plt.plot(epochs, data['val_accuracy'], label='Validation Accuracy', color='orange', linestyle='--', linewidth=2)
    plt.title('Model Accuracy over Time')
    plt.xlabel('Epochs')
    plt.ylabel('Accuracy')
    plt.legend()
    plt.grid(True)
  
    # Save to file
    plt.tight_layout()
    plt.savefig('accuracy_graph.png')
    print("Success! Graph saved as 'accuracy_graph.png'. Check your folder.")
    
    # Show on screen (optional)
    plt.show()

if __name__ == "__main__":
    plot_performance()