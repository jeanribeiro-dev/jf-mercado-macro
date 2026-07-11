import pandas as pd

xl = pd.ExcelFile('RELATORIO DE PERFORMACE.xlsx')
for sheet in xl.sheet_names:
    df = xl.parse(sheet)
    matches = df.astype(str).apply(lambda x: x.str.contains('2026-06-22')).any(axis=1)
    if matches.any():
        print(f"Found 2026-06-22 in sheet: {sheet}")
        print(df[matches].to_string())
