# How to Download Images from Figma

1. Open these links in Figma:
   - Personalized Reports: https://www.figma.com/design/hpTNGGbkA1VEBl3BLcaDuy/AstroAura-Designs?node-id=1999-21910
   - AURA AI Intro: https://www.figma.com/design/hpTNGGbkA1VEBl3BLcaDuy/AstroAura-Designs?node-id=1999-22130
   - Voice Chat: https://www.figma.com/design/hpTNGGbkA1VEBl3BLcaDuy/AstroAura-Designs?node-id=1999-22848

2. For each screen:
   - Select the frame (click on it)
   - Right-click → "Export" → Choose PNG
   - OR use Figma's export panel (right sidebar)
   - Save as:
     - mockup-personalized-reports.png
     - mockup-aura-intro.png
     - mockup-voice-chat.png

3. Place all 3 PNG files in: src/assets/

4. Uncomment the import statements in src/components/MobileMockup.tsx (lines 4-6)
   and comment out the placeholder URLs (lines 9-11)
