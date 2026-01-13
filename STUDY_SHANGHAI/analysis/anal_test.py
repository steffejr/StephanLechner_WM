import pandas as pd
import json
import io

# Read the raw text file
with open('jatos_results_data_20251229031054.txt', 'r') as f:
    content = f.read()

# Split into parts: CSV data and JSON metadata
lines = content.strip().split('\n')

# Find where CSV ends and JSON begins
csv_lines = []
json_parts = []

for line in lines:
    if line.startswith('{'):
        json_parts.append(line)
    else:
        csv_lines.append(line)

# Parse CSV data (mind wandering in this case)
csv_text = '\n'.join(csv_lines)
df_mind_wandering = pd.read_csv(io.StringIO(csv_text))

print("Mind Wandering Data:")
print(df_mind_wandering)
print("\n" + "="*50 + "\n")

# Parse JSON data
combined_json = ''.join(json_parts)

# The JSON parts are concatenated, need to separate them
# They're joined without separator, so we need to find the boundaries
json_objects = []
decoder = json.JSONDecoder()
idx = 0
while idx < len(combined_json):
    try:
        obj, end_idx = decoder.raw_decode(combined_json, idx)
        json_objects.append(obj)
        idx = end_idx
    except json.JSONDecodeError:
        idx += 1

print(f"Found {len(json_objects)} JSON objects")

# Find the combined data object (it has 'experiments' key)
combined_data = None
for obj in json_objects:
    if 'experiments' in obj:
        combined_data = obj
        break

if combined_data:
    print("\nSubject ID:", combined_data['subject_id'])
    print("Session Date:", combined_data['session_date'])
    
    # Extract finger tapping CSV
    if 'fingerTapping' in combined_data['experiments']:
        ft_csv = combined_data['experiments']['fingerTapping']['csv']
        df_finger_tapping = pd.read_csv(io.StringIO(ft_csv))
        
        print("\nFinger Tapping Data:")
        print(df_finger_tapping)
        print(f"Total taps: {len(df_finger_tapping)}")
        
        # Save to separate file
        df_finger_tapping.to_csv(f"{combined_data['subject_id']}_fingertapping.csv", index=False)
    
    # Extract mind wandering CSV
    if 'mindWandering' in combined_data['experiments']:
        mw_csv = combined_data['experiments']['mindWandering']['csv']
        df_mind_wandering_from_json = pd.read_csv(io.StringIO(mw_csv))
        
        print("\nMind Wandering Data:")
        print(df_mind_wandering_from_json)
        
        # Save to separate file
        df_mind_wandering_from_json.to_csv(f"{combined_data['subject_id']}_mindwandering.csv", index=False)
    
    print("\n✓ Data extracted and saved to separate CSV files")
else:
    print("Could not find combined data object")