import os
from pathlib import Path

PARSED_DIR = Path(__file__).resolve().parent.parent / "corpus" / "parsed"
PARSED_DIR.mkdir(parents=True, exist_ok=True)

DOCUMENTS = {
    "usda-dga-2020": """## Executive Summary
The Dietary Guidelines for Americans, 2020-2025 provides recommendations on what to eat and drink to promote health, reduce risk of chronic disease, and meet nutrient needs.

## Nutritional Goals for Age-Sex Groups
Adult women need about 46 grams of protein per day, while adult men need about 56 grams.
Fibre recommendations are 25 grams daily for women and 30-38 grams for men.
Sodium should be limited to less than 2,300 milligrams per day for adults.
Saturated fat should be limited to less than 10% of total daily calories.

## Dietary Patterns
A healthy dietary pattern consists of nutrient-dense forms of foods and beverages across all food groups, in recommended amounts, and within calorie limits.
Vegetables of all types—dark green; red and orange; beans, peas, and lentils; starchy; and other vegetables.
Fruits, especially whole fruit.
Grains, at least half of which are whole grains.
Dairy, including fat-free or low-fat milk, yogurt, and cheese, and/or lactose-free versions and fortified soy beverages and yogurt as alternatives.
""",

    "who-healthy-diet": """## Overview
A healthy diet helps to protect against malnutrition in all its forms, as well as noncommunicable diseases (NCDs), including such as diabetes, heart disease, stroke and cancer.
Unhealthy diet and lack of physical activity are leading global risks to health.

## Practical Advice
Adults should consume at least 400 g (i.e. five portions) of fruit and vegetables per day, excluding potatoes, sweet potatoes, cassava and other starchy roots.
Energy intake (calories) should be in balance with energy expenditure. To avoid unhealthy weight gain, total fat should not exceed 30% of total energy intake.
Intake of saturated fats should be less than 10% of total energy intake, and intake of trans-fats less than 1% of total energy intake.
Free sugars should be less than 10% of total energy intake, and ideally less than 5% for additional health benefits.
Salt intake should be less than 5 g per day (equivalent to sodium intake of less than 2 g per day).
""",

    "uk-eatwell-2016": """## The Eatwell Guide
The Eatwell Guide shows how much of what we eat overall should come from each food group to achieve a healthy, balanced diet.
You do not need to achieve this balance with every meal, but try to get the balance right over a day or even a week.

## Carbohydrates
Base meals on potatoes, bread, rice, pasta or other starchy carbohydrates; choosing wholegrain versions where possible.
Starchy food should make up just over a third of the food we eat. Choose higher fibre wholegrain varieties, such as wholewheat pasta and brown rice, or simply leave the skins on potatoes.

## Hydration
Drink 6-8 cups/glasses of fluid a day. Water, lower fat milk and sugar-free drinks, including tea and coffee, all count.
Fruit juice and smoothies also count towards your fluid consumption, but they contain free sugars that can damage teeth, so limit these drinks to a combined total of 150ml a day.
""",

    "efsa-drv-2017": """## Introduction to Dietary Reference Values
Dietary Reference Values (DRVs) is an umbrella term for a set of nutrient reference values that include the Population Reference Intake (PRI), the Average Requirement (AR), the Adequate Intake (AI) and the Reference Intake (RI).

## Protein Requirements
The Population Reference Intake (PRI) for protein for adults is 0.83 g per kg body weight per day.
This PRI is applicable to both high quality protein (e.g., meat, fish, eggs, dairy) and lower quality protein when consumed in a mixed diet.

## Vitamins and Minerals
The PRI for Vitamin C is 110 mg/day for men and 95 mg/day for women.
The AI for potassium for adults is 3,500 mg/day.
The AI for calcium is 950 mg/day for adults aged 25 years and older.
""",

    "foodsafety-cold-storage": """## Cold Food Storage Guidelines
Properly storing food in the refrigerator or freezer helps prevent foodborne illnesses.
The refrigerator temperature should be set to 40°F (4°C) or below, and the freezer at 0°F (-18°C) or below.

## Ground Meat
Raw ground beef, veal, pork, or lamb can be stored in the refrigerator for 1 to 2 days.
In the freezer, it can be kept for 3 to 4 months.

## Fresh Poultry
Raw chicken or turkey, whole or in pieces, should be kept in the refrigerator for 1 to 2 days.
In the freezer, whole poultry can be kept for up to 1 year, and pieces for up to 9 months.

## Leftovers
Cooked meat or poultry leftovers can be stored in the refrigerator for 3 to 4 days.
They can be safely frozen for 2 to 6 months.
Pizza can be kept in the fridge for 3 to 4 days.
""",

    "au-dietary-2013": """## Guideline 1: Achieve and maintain a healthy weight
To achieve and maintain a healthy weight, be physically active and choose amounts of nutritious food and drinks to meet your energy needs.
Children and adolescents should eat sufficient nutritious foods to grow and develop normally.

## Guideline 2: Enjoy a wide variety of nutritious foods
Enjoy a wide variety of nutritious foods from these five groups every day:
- Plenty of vegetables, including different types and colours, and legumes/beans
- Fruit
- Grain (cereal) foods, mostly wholegrain and/or high cereal fibre varieties
- Lean meats and poultry, fish, eggs, tofu, nuts and seeds, and legumes/beans
- Milk, yoghurt, cheese and/or their alternatives, mostly reduced fat

## Guideline 3: Limit intake of certain foods
Limit intake of foods containing saturated fat, added salt, added sugars and alcohol.
Replace high fat foods which contain predominantly saturated fats such as butter, cream, cooking margarine, coconut and palm oil with foods which contain predominantly polyunsaturated and monounsaturated fats such as oils, spreads, nut butters/pastes and avocado.
""",

    "fda-food-code-2022": """## Chapter 1: Purpose and Definitions
The purpose of this Code is to safeguard public health and provide to consumers food that is safe, unadulterated, and honestly presented.

## Chapter 3: Food
Food shall be safe, unadulterated, and honestly presented.
Food shall be obtained from sources that comply with law.

## Temperature Control for Safety (TCS)
Time/Temperature Control for Safety Food (TCS) shall be maintained at 41°F (5°C) or less, or 135°F (57°C) or above.
Raw animal foods such as eggs, fish, meat, poultry, and foods containing these raw animal foods, shall be cooked to heat all parts of the food to a temperature and for a time that complies with the Code.
Pork, beef, veal, and lamb steaks or chops must be cooked to an internal temperature of 145°F (63°C) for 15 seconds.
Poultry must be cooked to 165°F (74°C) for <1 second (instantaneous).
"""
}

for doc_id, text in DOCUMENTS.items():
    with open(PARSED_DIR / f"{doc_id}.txt", "w", encoding="utf-8") as f:
        f.write(text.strip())
    print(f"Generated {doc_id}.txt")

print("✅ Successfully generated all synthetic parsed corpus files.")
