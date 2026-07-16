// --- FILE: supabase/functions/generate-yogas/index.ts ---

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai';
import { createCorsWrappedHandler } from '../_shared/cors.ts';

// --- Abridged Yoga Knowledge Base (for brevity, replace with your full text) ---
const YOGA_KNOWLEDGE_BASE = `
EXALTATION & DIGNITY YOGAS					
1	Sun Exalted	Dignity	Sun in Aries (0°-30°), peak at 10°	Maximum vitality, authority, leadership, father's blessings, government favor	50
2	Moon Exalted	Dignity	Moon in Taurus (0°-30°), peak at 3°	Emotional stability, mental peace, mother's blessings, public popularity	50
3	Mars Exalted	Dignity	Mars in Capricorn (0°-30°), peak at 28°	Courage, discipline, military success, real estate gains	50
4	Mercury Exalted	Dignity	Mercury in Virgo (0°-30°), peak at 15°	Supreme intelligence, business acumen, analytical skills, communication mastery	50
5	Jupiter Exalted	Dignity	Jupiter in Cancer (0°-30°), peak at 5°	Wisdom, fortune, children's blessings, spiritual growth, prosperity	50
6	Venus Exalted	Dignity	Venus in Pisces (0°-30°), peak at 27°	Luxury, beauty, artistic talents, marital bliss, vehicles	50
7	Saturn Exalted	Dignity	Saturn in Libra (0°-30°), peak at 20°	Discipline, longevity, justice, organized success, service excellence	50
8	Planet in Own Sign	Dignity	Planet occupying its rulership sign	Reliable expression, steady results, domain mastery	30
9	Planet in Mooltrikona	Dignity	Planet in its Mooltrikona portion	Very strong, predictable positive outcomes	40
10	Planet Debilitated	Affliction	Planet in its debilitation sign (unless cancelled)	Weakness, struggles, compromised results in that planet's domain	-50
11	Neecha Bhanga Raja Yoga	Cancellation	Debilitated planet with: (1) Exaltation lord in kendra, OR (2) Dispositor in kendra, OR (3) Aspected by exaltation lord	Rise from low position, unexpected greatness, redemption story	82
PANCHA MAHAPURUSHA YOGAS (5 Great Person Yogas)					
12	Ruchaka Yoga	Mahapurusha	Mars in kendra (1,4,7,10) in own sign (Aries/Scorpio) or exaltation (Capricorn), not combust	Warrior spirit, courage, military/sports success, leadership, land wealth	90
13	Bhadra Yoga	Mahapurusha	Mercury in kendra in own (Gemini/Virgo) or exaltation (Virgo), not combust	Intellect, eloquence, business success, writing/speaking mastery	90
14	Hamsa Yoga	Mahapurusha	Jupiter in kendra in own (Sagittarius/Pisces) or exaltation (Cancer), not combust	Wisdom, spirituality, teaching excellence, prosperity, virtuous life	90
15	Malavya Yoga	Mahapurusha	Venus in kendra in own (Taurus/Libra) or exaltation (Pisces), not combust	Luxury, beauty, arts, vehicles, comforts, marital happiness	90
16	Sasa Yoga	Mahapurusha	Saturn in kendra in own (Capricorn/Aquarius) or exaltation (Libra), not combust	Authority, discipline, longevity, administrative power, servant leadership	90
RAJA YOGAS (Royal/Power Combinations)					
17	Kendra-Trikona Raja Yoga	Raja Yoga	Lord of kendra (1,4,7,10) conjunct or mutually aspecting lord of trikona (1,5,9)	Power, authority, success, recognition, leadership positions	75-85
18	Dharma-Karmadhipati Yoga	Raja Yoga	9th lord and 10th lord conjunct, in kendra/trikona, or mutually aspecting	Exceptional career, righteous wealth, dharmic success, authority	90
19	Rajayoga (General)	Raja Yoga	Yogakaraka planet strong and unafflicted in good house	Ascension to power, recognition, wealth, status elevation	85
20	Viparita Raja Yoga (Type 1 - Harsha)	Raja Yoga	6th lord in 6th, 8th, or 12th house	Victory over enemies, health recovery, success through adversity	76
21	Viparita Raja Yoga (Type 2 - Sarala)	Raja Yoga	8th lord in 6th, 8th, or 12th house	Longevity, courage, sudden wealth, occult powers	78
22	Viparita Raja Yoga (Type 3 - Vimala)	Raja Yoga	12th lord in 6th, 8th, or 12th house	Good character, spiritual gains, economical nature, foreign success	77
23	Neecha Bhanga Raja Yoga	Raja Yoga	Debilitated planet's dispositor in kendra or exaltation lord aspects it	Transformation from weakness to strength, late-blooming success	82
24	Yogakaraka Activation	Raja Yoga	For Cancer: Mars; Leo: Mars; Taurus/Libra: Saturn; Capricorn/Aquarius: Venus; Gemini: Venus; Sagittarius/Pisces: Mars+Moon well-placed	Double benefic effect, accelerated growth in ruled houses	88
25	Parivraja Yoga (Renunciation)	Raja Yoga	4 or more planets in single sign, aspected by Saturn, with Lagna lord weak	Spiritual authority, renunciation, monastic leadership, detachment	70
26	Chamara Yoga	Raja Yoga	Exalted planet in kendra from Lagna or Moon	Royal attendant, luxury, servants, high-class service	84
27	Sankha Yoga	Wealth/Raja	5th and 6th lords in mutual kendras, both strong	Conch-like prosperity, virtue, long life, righteous wealth	77
28	Parijata Yoga	Raja Yoga	Ascendant lord exalted in kendra or trikona	Celestial blessing, honor, happiness, royal qualities	88
29	Political Power Yoga	Raja Yoga	Sun in 10th house, especially in exaltation/own sign	Government authority, political success, administrative power	82
30	Authority Yoga	Raja Yoga	Ascendant lord exalted in kendra or trikona	Leadership recognition, boss/management roles, public authority	79
DHANA YOGAS (Wealth Combinations)					
31	Dhana Yoga (2-11)	Wealth	2nd lord and 11th lord conjunct or mutually aspecting	Wealth accumulation, steady income, financial security	75
32	Dhana Yoga (1-2-11)	Wealth	Lagna lord, 2nd lord, 11th lord connected	Self-made fortune, multiple income sources, entrepreneurial wealth	85
33	Dhana Yoga (2-5-9-11)	Wealth	Any combination of 2nd, 5th, 9th, 11th lords well-placed and connected	Strong wealth accumulation, investments, speculative gains	80
34	Lakshmi Yoga	Wealth	Venus in kendra, 9th lord strong, both well-placed	Goddess of wealth's blessing, luxury, divine grace, prosperity	88
35	Kubera Yoga	Wealth	Jupiter-Venus-Mercury mutual aspects or in wealth houses	God of wealth's blessing, treasure, sudden riches	86
36	Chandra-Mangal Yoga	Wealth	Moon and Mars conjunct, especially in 1,2,4,7,10,11	Real estate wealth, property gains, mother's support in finances	72
37	Jupiter-Venus Dhana Yoga	Wealth	Jupiter and Venus conjunct or mutually aspecting	Wealth through wisdom, teaching, counseling, arts, advisory	80
38	Shankha Yoga	Wealth	5th and 6th lords in mutual kendras	Conch-like abundance, dharmic wealth, longevity, pleasure	77
39	Bheri Yoga	Wealth	Venus, Jupiter, Lagna lord all strong in good houses	Drum-like fame, family wealth, longevity, happiness	81
40	Go Yoga	Wealth	Jupiter in 2nd from Moon	Cattle/vehicle wealth, property, dairy business, pastoral success	73
41	Gaja Yoga	Wealth	Moon in 11th from Jupiter	Elephant-like wealth, vehicles, large gains, royal status	74
42	Vasumathi Yoga	Wealth	Benefics in upachaya houses (3,6,10,11) from Moon	Prosperity, accumulation, business growth, strategic wealth	74
43	Pushkala Yoga	Wealth	Lagna lord with Moon in good house (kendra/trikona/2nd)	Self-abundance, many possessions, material comfort, security	79
44	Property Yoga (Mars 4th)	Wealth	Mars in 4th house, especially in own/exaltation	Real estate gains, land ownership, property development	71
45	Property Gains Yoga	Wealth	4th lord and 11th lord conjunct or mutually aspecting	Profit from property, real estate investments, land income	74
46	Sudden Wealth Yoga	Wealth	8th lord and 11th lord connected, especially with Rahu/Uranus	Inheritance, lottery, windfall, unexpected gains, hidden wealth	73
47	Business Yoga (Mercury)	Wealth	Mercury strong in 2nd, 10th, or 11th house	Business acumen, trade success, commercial intelligence, deals	75
48	Partnership Business Yoga	Wealth	7th lord and 10th lord conjunct or well-connected	Successful partnerships, joint ventures, collaborative wealth	77
49	Kalanidhi Yoga	Wealth/Arts	Jupiter and Venus in mutual kendras	Arts, music, dance, cultural wealth, refined prosperity	80
CHANDRA YOGAS (Lunar Combinations)					
50	Sunaphaa Yoga	Lunar	Planets (except Sun) in 2nd house from Moon	Self-made wealth, intelligence, independence, respected, earning power	65
51	Anaphaa Yoga	Lunar	Planets (except Sun) in 12th house from Moon	Fame, good character, luxuries, charitable nature, spiritual wealth	65
52	Durudhara Yoga	Lunar	Planets on both sides (2nd & 12th) of Moon	Wealth, vehicles, influence, balanced personality, comprehensive success	80
53	Adhi Yoga	Lunar	Benefics (Jupiter/Venus/Mercury) in 6th, 7th, 8th from Moon	Longevity, health, authority, respect, wealth, overcoming obstacles	85
54	Gajakesari Yoga	Lunar/Raja	Jupiter and Moon in mutual kendras (1,4,7,10 from each other)	Elephant-lion combined power: wisdom, wealth, fame, leadership	92
55	Chandra-Mangal Yoga	Lunar/Wealth	Moon and Mars conjunct	Wealth from property/land, aggressive earning, mother issues possible	70
56	Vish Yoga	Lunar/Affliction	Saturn and Moon conjunct	Emotional coldness, depression, pessimism, mental suffering	-58
57	Shakata Yoga	Lunar/Affliction	Jupiter and Moon in 6/8 position from each other	Cart-like ups and downs, fortune fluctuations, instability	-55
58	Kemadruma Yoga	Lunar/Affliction	No planets in houses adjacent (2nd/12th) to Moon AND no planets in kendras from Moon	Poverty, mental struggles, isolation, lack of support	-65
SURYA YOGAS (Solar Combinations)					
59	Budha-Aditya Yoga	Solar/Education	Sun and Mercury conjunct (within 10-15°), Mercury not severely combusted	Intelligence, political skill, administrative ability, fame, communication power	70
60	Sun-Moon Yoga (New Moon)	Solar	Sun and Moon conjunct (within 12°)	Amavasya energy: introspection, new beginnings, ego-emotion fusion	60
61	Sun-Moon Yoga (Full Moon)	Solar	Sun and Moon opposite (180°)	Purnima energy: completion, illumination, public visibility	65
62	Vesi Yoga	Solar	Planets (except Moon) in 2nd from Sun	Self-made success, balanced personality, prosperous later life	62
63	Vashi Yoga	Solar	Planets (except Moon) in 12th from Sun	Diplomatic, well-spoken, influential through communication	62
64	Ubhayachari Yoga	Solar	Planets on both sides (2nd & 12th) of Sun	Independent, self-reliant, kingly qualities, balanced approach	72
EDUCATION & INTELLIGENCE YOGAS					
65	Saraswati Yoga	Education	Jupiter, Venus, Mercury in kendras/trikonas/2nd, all strong	Learning, eloquence, scholarship, artistic talent, wisdom, cultural refinement	85
66	Budha-Aditya Yoga	Education	Sun-Mercury conjunction (see #59)	Intelligence, analytical skills, political acumen	70
67	Vidya Yoga	Education	4th lord and 5th lord connected, Jupiter strong	Education success, degrees, academic excellence, teaching ability	75
68	Khyati Yoga	Education/Fame	Jupiter exalted or in own sign in kendra/trikona	Fame through knowledge, scholarly recognition, teaching excellence	78
MARRIAGE & RELATIONSHIP YOGAS					
69	Kalatra Yoga	Marriage	7th lord well-placed in 1,4,5,7,9,10	Happy marriage, good spouse, partnership success, harmony	72
70	Venus-Jupiter Marriage Yoga	Marriage	Venus and Jupiter connected by conjunction/aspect	Good marriage prospects, virtuous spouse, marital happiness, dharmic partner	76
71	Saubhagya Yoga	Marriage	All benefics in upachayas, 7th lord strong	Marital fortune, beautiful spouse, harmonious relationship	75
72	Delayed Marriage Yoga	Marriage/Affliction	Saturn in 7th house OR Saturn aspecting 7th house/lord	Marriage delay, older spouse, karmic relationships, maturity needed	-45
73	Multiple Relationship Yoga	Marriage/Affliction	Venus with malefics in 7th, 7th lord heavily afflicted	Multiple relationships, marriage difficulties, separations, divorces	-48
74	Mangal Dosha (Manglik)	Marriage/Affliction	Mars in 1,2,4,7,8,12 from Lagna/Moon/Venus	Marriage obstacles, spouse's health issues, conflicts (cancelled if both partners have it)	-60
75	Rahu-7th Yoga	Marriage/Affliction	Rahu in 7th house	Unconventional partner, foreign spouse, non-traditional marriage, karmic relationship	-40
PROGENY & CHILDREN YOGAS					
76	Putra Sukha Yoga	Children	Jupiter in 5th house, especially in own/exaltation, 5th lord strong	Blessed with children, intelligent offspring, good progeny, paternal joy	76
77	Suta Yoga	Children	5th lord in 5th house or exalted, Jupiter well-placed	Excellent children, academic success of offspring, lineage continuation	74
78	Putra Dosha	Children/Affliction	5th lord in 6,8,12, malefics in 5th, no benefic aspect	Difficulty conceiving, fertility issues, children's health challenges	-57
79	Aputra Yoga	Children/Affliction	5th house and lord severely afflicted, Jupiter weak	Childlessness, adoption possibilities, spiritual progeny instead	-62
SPIRITUAL & MOKSHA YOGAS					
80	Pravrajya Yoga Type 1	Spiritual	12th lord (Jupiter/Saturn/Ketu) in 1st, 9th, or 12th house	Renunciation tendency, detachment, spirituality, meditation	70
81	Pravrajya Yoga Type 2	Spiritual	Moon in Navamsa of Saturn/Mars with Saturn in kendra	Monastic inclination, ascetic life, withdrawal from worldly pursuits	68
82	Jupiter-Ketu Spiritual Yoga	Spiritual	Jupiter and Ketu conjunct	Deep spirituality, mysticism, liberation seeking, past-life wisdom, moksha path	75
83	Sanyasa Yoga	Spiritual	10th lord in 12th house, 4 or more planets in one sign	Renunciation of worldly career, spiritual vocation, monastery, ashram life	68
84	Moksha Yoga	Spiritual	Ketu-Mercury-Jupiter connection, 12th house occupied by spiritual planets	Liberation mindset, detachment, spiritual practices, final freedom	72
85	Occult Ability Yoga (Ketu)	Spiritual	Ketu in 8th or 12th house	Psychic abilities, occult knowledge, mystical experiences, hidden wisdom	73
86	Psychic Yoga (Moon-Ketu)	Spiritual	Moon and Ketu conjunct	Intuition, psychic sensitivity, spiritual visions, past-life recall, mediumship	71
87	Mystical Knowledge Yoga	Spiritual	8th lord in 9th or 12th house	Occult studies, tantra, mysticism, esoteric knowledge, secret sciences	70
88	Tapasvi Yoga	Spiritual	Rahu-Saturn conjunction in 8th or 12th	Intense sadhana, austerity, transformational spiritual practices	69
ARISHTA YOGAS (Affliction/Difficult Combinations)					
89	Kala Sarpa Yoga	Affliction	All planets between Rahu and Ketu (on one side of nodal axis)	Karmic struggles, serpent curse, obstacles, delays, ultimate success after suffering	-75
90	Grahan Yoga (Solar Eclipse)	Affliction	Sun conjunct Rahu or Ketu	Father issues, authority struggles, identity confusion, ego dissolution	-70
91	Grahan Yoga (Lunar Eclipse)	Affliction	Moon conjunct Rahu or Ketu	Mother issues, mental instability, emotional turbulence, mind-body disconnect	-70
92	Angarak Yoga	Affliction	Mars and Rahu conjunct	Aggression, accidents, violence, explosions, impulsive disasters	-65
93	Guru Chandal Yoga	Affliction	Jupiter conjunct Rahu or Ketu	Unconventional wisdom, guru problems, religious confusion, moral dilemmas	-60
94	Vish Yoga	Affliction	Saturn and Moon conjunct	Emotional coldness, depression, delays, pessimism, mental poisoning	-58
95	Shakata Yoga	Affliction	Jupiter-Moon in 6/8 (see #57)	Cart-wheel fortune fluctuation, instability	-55
96	Daridra Yoga	Affliction	11th lord in 6th, 8th, or 12th house	Poverty, financial blocks, loss of gains, income obstacles	-62
97	Kemadruma Yoga	Affliction	Moon isolated (see #58)	Poverty, isolation, lack of support	-65
98	Papa Kartari Yoga	Affliction	Important house hemmed by malefics on both sides (12th and 2nd from it)	Obstruction, suffering in that house matters, malefic squeeze	-68
99	Dur Yoga	Affliction	10th lord in 6th, 8th, or 12th house	Career struggles, professional obstacles, loss of reputation	-60
100	Matru Dosha	Affliction	4th lord in dusthana, Moon afflicted	Mother's health issues, property problems, emotional challenges, home conflicts	-55
101	Pitru Dosha	Affliction	9th lord in dusthana, Sun afflicted	Father's challenges, loss of paternal support, ancestral karma, dharma confusion	-55
102	Balarishta Yoga	Affliction	Lagna lord and 8th lord conjunct, Moon in 6th/8th/12th, malefics in kendra	Early childhood danger, health issues in infancy	-70
NABHASA YOGAS (Planetary Distribution Patterns)					
103	Yupa Yoga	Nabhasa	All planets in 4 consecutive houses from Lagna	Spirituality, rituals, religious nature, prosperity, focused energy	70
104	Gada Yoga	Nabhasa	All planets in 2 consecutive signs	Learning, weaponry skills, tools mastery, concentrated power	68
105	Rajju Yoga	Nabhasa	All planets in movable signs (Aries/Cancer/Libra/Capricorn)	Traveling, wandering, restlessness, foreign connections, movement	65
106	Musala Yoga	Nabhasa	All planets in fixed signs (Taurus/Leo/Scorpio/Aquarius)	Stability, determination, wealth, pride, stubbornness, endurance	65
107	Nala Yoga	Nabhasa	All planets in dual signs (Gemini/Virgo/Sagittarius/Pisces)	Versatility, multiple skills, adaptability, craftsmanship, duality mastery	65
108	Mridanga Yoga	Nabhasa	All planets in kendras or trikonas	Musical talent, arts, fame, wealth, artistic excellence, perfect distribution	86
109	Srik Yoga	Nabhasa	All planets in kendras only	Comfort, happiness, authority, power concentration	75
110	Sarpa Yoga	Nabhasa	All planets in trikonas only	Misery in early life, success later, serpentine journey	60
SPECIAL COMBINATION YOGAS					
111	Amala Yoga	Special	Benefic in 10th house from Lagna or Moon	Lasting fame, purity, good character, compassion, untarnished reputation	78
112	Parvata Yoga	Special	Benefics in kendras, 6th & 8th empty of malefics	Charitable, wealthy, famous, learned, mountain-like stability	82
113	Kahala Yoga	Special	4th lord and 9th lord in mutual kendras	Courage, boldness, wealth, authority, aggressive success	75
114	Shubha Kartari Yoga	Special	Benefics hemming important house on both sides (2nd & 12th from it)	Protection, enhancement of house matters, benefic embrace	75
115	Nipuna Yoga	Special	Mercury in 2nd, 5th, or 9th from own sign	Skillful, expert, craftsmanship, technical mastery	70
116	Kusuma Yoga	Special	Jupiter in Lagna, Venus in 4th, Moon in 7th	Flower-like beauty and grace, happiness, comforts	74
117	Matsya Yoga	Special	All planets in 1st and 7th houses only	Fish-like movement, duality, partnership focus	65
118	Kurma Yoga	Special	All planets in 5th and 9th houses only	Turtle-like slow but steady growth, dharma-oriented	66
119	Koorma Yoga (alternate)	Special	All benefics in kendras, malefics in 3rd & 11th	Long life, famous, strategic placement	72
120	Kedara Yoga	Special	All planets in 2nd, 5th, 8th, 11th houses	Agricultural success, land wealth, farming prosperity	68
121	Shoola Yoga	Special	All planets in 3rd, 6th, 9th, 12th houses	Troubles, pain, suffering but eventual overcoming	55
122	Hala Yoga	Special	All planets in movable signs only	Plow-like hard work, agricultural success, labor rewards	64
123	Vajra Yoga	Special	All benefics in Lagna & 7th OR all in 4th & 10th	Diamond-like strength, unshakable, powerful personality	80
124	Yava Yoga	Special	All planets in Lagna & 4th OR 7th & 10th	Happiness, wealth, success, grain-like abundance	72
125	Kamala Yoga	Special	All planets in 4 kendras	Lotus-like beauty and grace, fame, wealth, spiritual evolution	85
126	Vapee Yoga	Special	All planets in 4th and 10th houses	Well-like depth, accumulation, success in property	70
127	Shringataka Yoga	Special	Jupiter in Lagna/5th, benefic in kendra, Lagna lord strong	Crossroads blessing, multiple opportunities, versatile success	76
PROFESSIONAL & CAREER YOGAS					
128	Karma Jeeva Yoga	Career	Strong 10th house and lord, Sun-Saturn-Mars well-placed	Professional excellence, career dedication, workaholic success	77
129	Foreign Settlement Yoga	Career	12th lord in kendra, strong connection between 9th and 12th	Foreign settlement, international career, overseas success, immigration	69
130	Foreign Connection Yoga	Career	Rahu in 9th or 12th house, strong	Strong foreign connections, international exposure, cross-cultural work	67
131	Government Job Yoga	Career	Sun in 10th, Saturn in 6th or 10th, strong connection	Government service, public sector, bureaucracy, civil service	75
132	Medical Profession Yoga	Career	Mars-Mercury-Jupiter connection, 6th house active	Medical field, surgery, healing professions, healthcare	74
133	Legal Profession Yoga	Career	Mercury-Jupiter-Saturn connection, strong 7th house	Law, judiciary, legal advocacy, justice system	73
134	Teaching Profession Yoga	Career	Jupiter in 2nd/5th/9th, Mercury strong	Teaching, education, professorship, knowledge dissemination	75
135	Engineering Yoga	Career	Mars-Saturn-Mercury connection, 3rd/6th/10th active	Engineering, technical fields, machinery, construction	74
136	Media & Communication Yoga	Career	Mercury-Venus-Rahu, 2nd/3rd houses strong	Media, journalism, broadcasting, public relations, advertising	73
137	Arts & Entertainment Yoga	Career	Venus-Moon-Mercury, 5th house strong	Acting, music, dance, entertainment, creative arts	76
138	Spiritual Teacher Yoga	Career	Jupiter-Ketu connection, 9th/12th houses active	Spiritual teaching, guru, religious leadership, priesthood	77
HEALTH & LONGEVITY YOGAS					
139	Ayush Yoga (Longevity)	Health	8th lord in kendra/trikona, strong Lagna lord	Long life, good health, vitality, resilience, disease recovery	72
140	Saturn Longevity Yoga	Health	Saturn in 8th house (in friendly/own sign)	Extended lifespan, chronic but manageable health, slow aging	68
141	Alpayu Yoga (Short Life)	Health/Affliction	8th lord in 8th with malefics, Lagna lord weak, no benefic aspects	Short lifespan, severe health issues, life-threatening diseases	-75
142	Balarishta Yoga	Health/Affliction	Moon in 6th/8th/12th, malefics in kendras, no benefic protection	Infant mortality risk, early childhood diseases	-70
143	Rogagrasta Yoga	Health/Affliction	6th lord in Lagna with malefics, Lagna lord weak	Disease-prone, chronic health issues, immune weakness	-65
VEHICLE & PROPERTY YOGAS					
144	Vahana Yoga (Venus 4th)	Property	Venus in 4th house	Multiple vehicles, luxury cars, conveyances, comfort	72
145	Vahana Yoga (Venus-4th lord)	Property	Venus with 4th lord	Luxury vehicles, beautiful properties, comfortable living	70
146	Bhumi Yoga	Property	Mars in 4th, 4th lord strong, connection with 11th lord	Land ownership, real estate wealth, property inheritance	74
147	Griha Pravesh Yoga	Property	4th lord in kendra, benefics aspecting 4th	New home acquisition, property purchase, residential happiness	71
LOSS & EXPENDITURE YOGAS					
148	Vyaya Yoga	Loss	12th lord strong and connected to kendra/trikona lords	Expenses on good causes, spiritual spending, charity, foreign travel costs	50
149	Abhimana Yoga	Loss	12th lord in 9th or 10th with malefics	Loss of reputation, scandals, defamation, public disgrace	-60
150	Nashta Yoga	Loss	2nd lord in 6th, 8th, or 12th with 11th lord afflicted	Financial losses, theft, debt, bankruptcy tendency	-65
CURSE & KARMIC YOGAS					
151	Sarpa Dosha	Curse	Rahu-Ketu afflicting 5th house/lord with no Jupiter aspect	Serpent curse, childlessness, ancestral sins, reptile fear	-68
152	Pitru Dosha (Ancestral)	Curse	Sun in 5th/9th afflicted by Rahu/Ketu/Saturn	Ancestral curse, father lineage issues, paternal karma	-65
153	Matru Rina (Mother Debt)	Curse	Moon in 5th afflicted by malefics, 4th house damaged	Debt to mother, maternal karma, mother's unfulfilled desires	-60
154	Preta Badha	Curse	Saturn-Rahu in 8th/12th, Moon in 8th	Spirit affliction, ghostly disturbances, occult problems	-62
155	Brahma Shaap	Curse	Jupiter in 6th/8th/12th afflicted by Rahu-Ketu	Curse from Brahmin/priest, religious transgression karma	-70
FAME & RECOGNITION YOGAS					
156	Khyati Yoga	Fame	Jupiter exalted/own sign in kendra, 10th lord strong	Fame through knowledge, scholarly recognition, reputation	78
157	Keerthi Yoga	Fame	2nd lord in kendra from Lagna lord	Fame through speech, eloquence, communication, announcements	72
158	Lagna Malika Yoga	Fame	All houses occupied (no empty houses)	Complete life, all-round development, comprehensive fame	80
159	Budha Malika Yoga	Fame	Planets occupying 12 consecutive signs from Mercury	Communication mastery, intellectual fame, writing recognition	75
160	Raja Sambandha Yoga	Fame	10th/11th lord with Jupiter in kendra	Royal connections, VIP associations, elite circles	76
COURAGE & STRENGTH YOGAS					
161	Veera Yoga	Courage	Mars in Lagna/3rd/10th with Sun aspect	Warrior spirit, physical courage, bravery, heroism	78
162	Parakrama Yoga	Courage	3rd lord in 3rd house, Mars strong	Extraordinary valor, risk-taking ability, adventurous nature	74
163	Yuddha Yoga	Courage	Mars-Sun-Saturn connection with 6th/8th houses	Fighting ability, competitive success, victory in battles	75
PARTNERSHIP & FRIENDSHIP YOGAS					
164	Mitra Yoga	Friendship	11th lord strong in kendra/trikona	Good friends, supportive network, social success	70
165	Satva Yoga	Friendship	Jupiter-Venus in 11th or aspecting 11th	Loyal friends, virtuous associations, helpful allies	73
166	Durmitra Yoga	Friendship/Affliction	11th lord in 6th/8th/12th with malefics	False friends, betrayals, network problems, unreliable allies	-58
SIBLING YOGAS					
167	Sodarananda Yoga	Siblings	3rd lord strong in kendra/trikona, Mars well-placed	Happy relationship with siblings, supportive brothers/sisters	68
168	Sodarahani Yoga	Siblings/Affliction	3rd lord in dusthana, Mars afflicted, 3rd house damaged	Sibling loss, conflicts with brothers/sisters, separation	-60
TRAVEL YOGAS					
169	Desha Antara Yoga	Travel	9th/12th lords connected, Rahu in 3rd/9th/12th	Foreign travel, international journeys, settlement abroad	72
170	Samudra Yoga	Travel	Venus-Moon in 4th/9th/12th	Sea travel, overseas journeys, water-related travels	68
171	Videsh Yoga	Travel	12th lord strong, connected to 9th, Rahu prominent	Foreign residency, permanent settlement abroad, emigration	74
DEBT & LITIGATION YOGAS					
172	Runa Yoga	Debt/Affliction	6th lord strong, 2nd lord weak, connection with 8th/12th	Heavy debts, loan burdens, financial liabilities	-64
173	Vrana Yoga	Debt/Affliction	Mars-Saturn in 6th/8th with 6th lord	Chronic debts, legal troubles, wounds (physical/financial)	-66
174	Unmatta Yoga	Mental/Affliction	Moon with Saturn-Rahu-Mars, no Jupiter aspect	Mental instability, psychological disorders, madness	-75
PUNISHMENT & IMPRISONMENT YOGAS					
175	Bandha Yoga	Imprisonment	Lagna lord in 12th with malefics, Saturn-Mars-Rahu connection	Imprisonment risk, detention, confinement, legal penalties	-70
176	Karaagara Yoga	Imprisonment	12th lord in Lagna/8th, connection between 6th-8th-12th	Jail term, captivity, restrictions, loss of freedom	-72
ADDICTION & VICE YOGAS					
177	Madya Yoga	Addiction	Venus-Moon in 12th with Rahu-Saturn	Alcohol addiction, intoxication tendency, substance abuse	-65
178	Vyasana Yoga	Addiction	Venus afflicted by Rahu-Mars, 5th/8th houses damaged	Gambling addiction, speculation losses, compulsive behavior	-68
ACCIDENT & INJURY YOGAS					
179	Vishagatha Yoga	Accident	Mars-Saturn-Rahu connection in 6th/8th/12th	Poison risk, toxic exposure, venomous bites, accidents	-70
180	Shatra Yoga	Injury	6th lord with Mars in 8th or 12th	Weapon injuries, cuts, wounds, surgical interventions	-64
181	Bhagna Yoga	Injury	Mars-Saturn in 3rd/6th/8th affecting Lagna/Moon	Bone fractures, structural injuries, breaks	-62
SUCCESS TIMING YOGAS					
182	Asubha Viyoga Yoga	Success	6th/8th/12th lords mutually placed in dusthanas	Evil destruction, overcoming enemies, late-life success	70
183	Khala Yoga	Success	Jupiter-Venus-Mercury in 2nd/5th/9th	Victory over wicked opponents, righteous triumph	74
184	Parashari Raja Yoga	Success	Multiple benefic yogas active simultaneously	Supreme success, multi-dimensional achievement, legacy building	88
INHERITANCE YOGAS					
185	Ajeya Yoga	Inheritance	8th lord in 8th house in own/exaltation	Strong inheritance, ancestral wealth, hidden treasures	75
186	Sampatti Yoga	Inheritance	8th lord in 2nd/11th, benefic connections	Wealth through inheritance, legacy money, ancestral property	76
187	Marana Yoga	Inheritance/Death	2nd lord in 7th, 7th lord in 2nd (maraka exchange)	Death-inflicting combination, inheritance after loss	-68
LEADERSHIP YOGAS					
188	Simhasana Yoga	Leadership	Lagna lord exalted, Jupiter in Lagna, benefics in kendras	Throne position, supreme leadership, royal status	90
189	Hridaya Yoga	Leadership	Sun in 10th from Lagna/Moon, strong	Heart-centered leadership, loved by people, popular authority	80
190	Neta Yoga	Leadership	10th lord strong, Sun-Mars-Jupiter connection	Political/organizational leadership, team management	77
RESEARCH & ANALYSIS YOGAS					
191	Shodhana Yoga	Research	Mercury-Saturn-Ketu connection, 8th house activation	Research ability, investigation skills, analytical depth	76
192	Gaveshana Yoga	Research	Saturn in 3rd/8th, Mercury strong, Ketu in kendras	Scientific research, deep study, exploratory mindset	75
ARTISTIC TALENT YOGAS					
193	Sangita Yoga	Music	Venus-Mercury in 2nd/3rd/5th with Moon	Musical talent, singing ability, instrumental mastery	78
194	Nritya Yoga	Dance	Venus-Moon-Mars in kendras/trikonas	Dancing ability, rhythmic grace, performance arts	76
195	Kavi Yoga	Poetry	Mercury in 2nd/5th with Venus-Moon, Jupiter aspect	Poetic talent, creative writing, literary excellence	77
196	Chitra Yoga	Arts	Venus-Moon in 3rd/5th, Mercury strong	Painting, visual arts, design, aesthetic creativity	75
TECHNOLOGY & INNOVATION YOGAS					
197	Yantra Yoga	Technology	Mars-Mercury-Rahu connection in 3rd/6th/10th	Mechanical ability, engineering skills, technical innovation	74
198	Vigyana Yoga	Science	Mercury-Saturn-Uranus connection, 5th/9th houses	Scientific aptitude, logical reasoning, systematic thinking	76
HEALING PROFESSION YOGAS					
199	Vaidya Yoga	Healing	Mars-Moon-Jupiter in 6th/8th/12th	Medical profession, healing ability, therapeutic skills	77
200	Aushadha Yoga	Medicine	Mercury in 6th with Mars-Jupiter	Pharmaceutical knowledge, medicine preparation, herbalism	74
ADDITIONAL CLASSICAL YOGAS					
201	Indra Yoga	Power	5th lord and 11th lord exchange positions	God-king blessing, divine favor, supreme authority	85
202	Ravi Yoga	Solar Power	Sun in 10th with Mars aspect, Leo Lagna	Solar brilliance, government authority, paternal legacy	82
203	Chandra Yoga (General)	Lunar Power	Moon in Lagna/4th/5th in own/exaltation	Lunar grace, public appeal, nurturing leadership	80
204	Guru Mangal Yoga	Wisdom-Courage	Jupiter-Mars conjunction or mutual aspect	Spiritual warrior, principled fighter, dharmic courage	78
205	Sura Yoga	Divine Blessing	All benefics in upachaya from Lagna lord	Deity favor, divine protection, celestial grace	84
206	Danda Yoga	Punishment	Malefics in 2nd & 12th from Lagna/Moon	Stick-like punishment, disciplinary challenges, harsh lessons	-66
207	Mala Yoga	Garland	All planets in 1st, 2nd, 12th houses only	Garland pattern, concentrated energy, focused life	68
208	Sarala Yoga (alternate)	Protection	No malefics in 2nd, 4th, 5th from Lagna	Clear path, simple success, straightforward journey	70
209	Vipat Yoga	Danger	8th lord in 8th with malefics, Lagna lord weak	Calamity, disasters, catastrophic events, danger zones	-72
210	Utpata Yoga	Disaster	Mars-Saturn-Rahu in 6th/8th with no benefic aspect	Upheaval, sudden disasters, catastrophic changes	-74
Parivartan / Exchange Yogas (Most Powerful)	Yoga Name	Type	Description	Effect / Result	Strength
211	Maha Parivartan Yoga	Exchange	Exchange between 1st lord and 2,4,5,7,9,10,11 lords OR 5th lord with 7,9,10,11 lords	Supreme success, prosperity, Lakshmi's blessings, wealth, status, health	90
212	Kahala Parivartan Yoga	Exchange	Exchange between 4th and 9th lords	Courage, boldness, wealth, authority, communication mastery	85
213	Dharma-Karma Parivartan	Exchange	Exchange between 9th lord and 10th lord	Powerful Raja Yoga, enormous political success, high intelligence, dharmic career	92
214	Dainya Parivartan Yoga	Exchange/Affliction	Exchange between 6th, 8th, 12th lords (dusthana lords)	Poverty tendency, suffering, but can give Viparita results if strong	-55
215	Viparita Parivartan Yoga	Exchange	One dusthana lord (6,8,12) exchanges with kendra/trikona lord	Destruction of negativity, transformational success, triumph after hardship	78
216	Nakshatra Parivartan	Exchange	Two planets in each other's nakshatra (e.g., Venus in Ketu's nakshatra, Ketu in Venus's)	Subtle energy exchange, karmic connections, psychological transformation	70
217	Karaka Parivartan	Exchange	House karakas exchange positions (e.g., Jupiter in 1st, Sun in 2nd)	Extremely powerful, divine grace, fulfillment of house significations	88
218	Multi-Level Parivartan (3-way)	Exchange	Three planets forming closed loop exchange (A in B's sign, B in C's sign, C in A's sign)	Extreme co-dependence, powerful outcomes, multi-dimensional results	85
219	Multi-Level Parivartan (4-7 way)	Exchange	Four to seven planets in closed exchange loop	Mega transformation, life-defining patterns, rare and extremely powerful	90
#Graha Malika Yogas (Garland Yogas)	Yoga Name	Type	Description	Effect / Result	Strength
220	Lagna Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 1st house	Comprehensive life development, all-round success, self-focused growth	82
221	Dhana Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 2nd house	Wealth accumulation, financial mastery, material abundance	84
222	Vikrama Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 3rd house	Courage, communication excellence, sibling support, adventurous success	78
223	Sukha Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 4th house	Home happiness, mother's blessings, property, emotional security	80
224	Putra Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 5th house	Children's blessings, creativity, intelligence, speculative gains	82
225	Shatru Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 6th house	Victory over enemies, disease conquest, competitive success	76
226	Kalatra Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 7th house	Partnership excellence, marriage success, business prosperity	81
227	Randhra Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 8th house	Occult powers, inheritance, longevity, transformation mastery	79
228	Bhagya Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 9th house	Extreme fortune, dharmic success, father's blessings, spiritual growth	86
229	Karma Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 10th house	Career pinnacle, professional excellence, fame, authority	88
230	Labha Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 11th house	Massive gains, income multiplication, friend support, wish fulfillment	87
231	Vyaya Malika Yoga	Malika	All 7 planets in 7 consecutive houses starting from 12th house	Foreign settlement, spiritual liberation, moksha, expenditure on dharma	75
232	Budha Malika Yoga	Malika	All planets in 12 consecutive signs from Mercury	Communication mastery, intellectual fame, writing recognition, analytical excellence	80
#Nitya Yogas (Sun-Moon Distance Based - 27 Types)	Yoga Name	Type	Description	Effect / Result	Strength
233	Vishkambha Yoga	Nitya	Sun-Moon distance 0°-13°20'	Obstacles initially, success with effort, courageous nature	55
234	Priti Yoga	Nitya	Sun-Moon distance 13°20'-26°40'	Love, affection, popularity, harmonious relationships, pleasant personality	75
235	Ayushman Yoga	Nitya	Sun-Moon distance 26°40'-40°	Longevity, health, vitality, long life, healing abilities	78
236	Saubhagya Yoga	Nitya	Sun-Moon distance 40°-53°20'	Fortune, prosperity, good luck, auspiciousness, royal treatment	82
237	Shobhana Yoga	Nitya	Sun-Moon distance 53°20'-66°40'	Beauty, grace, artistic talents, attractive personality, refinement	76
238	Atiganda Yoga	Nitya	Sun-Moon distance 66°40'-80°	Obstacles, quarrels, conflicts, but ultimate victory, warrior spirit	50
239	Sukarma Yoga	Nitya	Sun-Moon distance 80°-93°20'	Good deeds, virtuous actions, dharmic nature, selfless service	77
240	Dhriti Yoga	Nitya	Sun-Moon distance 93°20'-106°40'	Patience, perseverance, determination, steady progress, resilience	74
241	Shoola Yoga	Nitya	Sun-Moon distance 106°40'-120°	Pain, suffering initially, but sharp intellect, penetrating insight	58
242	Ganda Yoga	Nitya	Sun-Moon distance 120°-133°20'	Obstacles, difficulties, but problem-solving abilities, crisis management	55
243	Vriddhi Yoga	Nitya	Sun-Moon distance 133°20'-146°40'	Growth, expansion, increase in all areas, prosperity, abundance	84
244	Dhruva Yoga	Nitya	Sun-Moon distance 146°40'-160°	Stability, fixed nature, unchanging principles, loyal, dependable	76
245	Vyaghata Yoga	Nitya	Sun-Moon distance 160°-173°20'	Conflicts, accidents, sudden events, but protective instincts, tiger-like courage	52
246	Harshana Yoga	Nitya	Sun-Moon distance 173°20'-186°40'	Happiness, joy, celebrations, cheerful nature, optimistic outlook	80
247	Vajra Yoga	Nitya	Sun-Moon distance 186°40'-200°	Diamond-hard determination, invincible strength, unbreakable will	85
248	Siddhi Yoga	Nitya	Sun-Moon distance 200°-213°20'	Accomplishment, achievement, perfection, spiritual attainment, success	87
249	Vyatipata Yoga	Nitya	Sun-Moon distance 213°20'-226°40'	Calamities, reversals, but capacity for extraordinary comebacks	48
250	Variyana Yoga	Nitya	Sun-Moon distance 226°40'-240°	Excellence, superiority, best quality, premium results, high standards	81
251	Parigha Yoga	Nitya	Sun-Moon distance 240°-253°20'	Obstruction, blockages, but gatekeeping abilities, protective barriers	54
252	Shiva Yoga	Nitya	Sun-Moon distance 253°20'-266°40'	Auspiciousness, divine grace, Shiva's blessings, spiritual protection	88
253	Siddha Yoga	Nitya	Sun-Moon distance 266°40'-280°	Perfected skills, mastery, accomplished abilities, expertise	83
254	Sadhya Yoga	Nitya	Sun-Moon distance 280°-293°20'	Achievable goals, attainable objectives, practical success, realization	79
255	Shubha Yoga	Nitya	Sun-Moon distance 293°20'-306°40'	Pure auspiciousness, goodness, beneficial outcomes, positive results	85
256	Shukla Yoga	Nitya	Sun-Moon distance 306°40'-320°	Brightness, clarity, pure white energy, cleansing, purification	78
257	Brahma Yoga	Nitya	Sun-Moon distance 320°-333°20'	Creator energy, innovative abilities, divine inspiration, cosmic consciousness	90
258	Indra Yoga	Nitya	Sun-Moon distance 333°20'-346°40'	Kingship, authority, divine power, celestial blessings, royal status	86
259	Vaidhriti Yoga	Nitya	Sun-Moon distance 346°40'-360°	Poverty tendency, hardships, but exceptional perseverance, ultimate wisdom	50
#Additional Rare & Powerful Yogas	Yoga Name	Type	Description	Effect / Result	Strength
260	Lakshmi Narayan Yoga	Wealth/Divine	9th lord strong in Lagna or 9th, Jupiter-Venus connection, benefic aspects	Divine couple's blessing, complete prosperity, spiritual+material wealth	92
261	Saraswati-Lakshmi Yoga	Education/Wealth	Mercury-Jupiter-Venus all strong in 2nd/5th/9th/11th	Learning + wealth, scholar + rich, arts + finance, complete abundance	88
262	Trilochana Yoga	Occult	Sun-Moon-Mars in 1st, 5th, 9th or mutual trines	Third-eye activation, clairvoyance, mystical abilities, divine vision	84
263	Rajyoga Karakatwa	Authority	Specific planet becomes raja yoga karaka for ascendant (Mars for Cancer/Leo, Saturn for Taurus/Libra, Venus for Capricorn/Aquarius)	Exceptional authority, natural leadership, life success guarantee	90
264	Maha Bhagya Yoga (Male)	Fortune	Male born in day time with Sun, Moon, Lagna all in odd signs	Great fortune, destiny support, everything falls in place, divine luck	86
265	Maha Bhagya Yoga (Female)	Fortune	Female born in night time with Sun, Moon, Lagna all in even signs	Great fortune, blessed life, material+spiritual prosperity, royal treatment	86
266	Amara Yoga	Immortality	Benefics in kendras from 11th lord, malefics in 3rd/6th/11th	Long life, deathless fame, lasting legacy, remembered forever	84
267	Bhagavat Bhakti Yoga	Devotion	9th lord with Venus-Jupiter, 5th house strong, 12th house occupied by benefics	Pure devotion, God-realization, saintly nature, divine grace	89
268	Mahabhagya Pada Yoga	Fortune	Ascendant in special padas: Simhasana (Leo) portions or Paravatamsa (Royal degrees)	Born with golden spoon, royal inheritance, destined for throne	87
269	Sreenatha Yoga	Supreme Wealth	7th lord exalted, 10th lord with Venus in kendra/trikona	Massive wealth, business empire, international success, multi-millionaire	91
270	Trimurthi Yoga	Divine Trinity	Sun-Moon-Mars in kendras or trikonas representing Brahma-Vishnu-Shiva	Divine protection, trinity blessings, complete life balance, spiritual+material	93
#Daridra Yogas (Poverty / Financial Affliction)	Yoga Name	Type	Description	Effect / Result	Strength
271	Daridra Yoga Type 1	Poverty	2nd lord in 6th, 8th, or 12th house (dusthana), weak or afflicted	Financial instability, difficulty accumulating wealth, loss of family wealth	-70
272	Daridra Yoga Type 2	Poverty	11th lord in 6th, 8th, or 12th house (dusthana), weak or debilitated	Blocked gains, income obstacles, unfulfilled desires, financial crises	-72
273	Daridra Yoga Type 3	Poverty	Both 2nd and 11th lords in dusthanas (6,8,12), afflicted by malefics	Severe poverty, riches to rags, unending financial struggles	-85
274	Daridra Yoga Type 4	Poverty	Malefic planets (Saturn/Mars/Rahu/Ketu) in 2nd house without benefic aspect	Loss of wealth through speech/face, harsh words cause financial loss	-65
275	Daridra Yoga Type 5	Poverty	Malefic planets in 11th house without benefic aspect	Gains blocked, income restricted, network problems, friend betrayals	-67
276	Daridra Yoga Type 6	Poverty	Jupiter debilitated in 6th, 8th, or 12th house	Loss of wisdom, bad financial decisions, misfortune, children's expenses	-68
277	Daridra Yoga Type 7	Poverty	2nd lord debilitated or in enemy sign, no benefic support	Weak financial foundation, family disputes over money, speech problems	-62
278	Daridra Yoga Type 8	Poverty	11th lord debilitated or combust, afflicted by nodes	Dreams unfulfilled, hopes dashed, income volatility, elder sibling issues	-64
279	Daridra Yoga Type 9 (Lagna Exchange)	Poverty	Lagna lord exchanges with 6th, 8th, or 12th lord (Dainya Parivartan)	Self-created poverty, bad decisions, health-wealth drain, service burdens	-75
280	Daridra Yoga Type 10	Poverty	Malefic in 4th from Moon without benefic aspect (Moon-based)	Emotional poverty, mental struggles, mother's financial issues	-58
281	Daridra Yoga Type 11	Poverty	Lords of 2nd and 11th mutually in 6/8 position from each other	Income-expense imbalance, debt cycles, litigation over money	-66
282	Daridra Yoga Type 12	Poverty	5th lord (poorva punya) in 6th, 8th, or 12th, afflicted	Loss of past-life merit, speculative losses, children's financial drain	-63
283	Daridra Yoga Type 13	Poverty	9th lord (bhagya) in dusthana with malefics, no benefic aspect	Loss of luck, father's financial decline, religious donations cause poverty	-69
284	Daridra Yoga Type 14	Poverty	10th lord (karma) in 6th, 8th, or 12th with malefics	Career instability, job loss, professional humiliation, status decline	-71
285	Daridra Yoga Type 15	Poverty	Venus (natural wealth karaka) debilitated and afflicted by Rahu/Saturn	Luxury addiction causes poverty, bad relationships drain wealth	-64
286	Daridra Yoga Type 16	Poverty	Multiple wealth houses (2,5,9,11) occupied by malefics without benefic aspects	Comprehensive financial blockage, all doors to wealth closed	-80
287	Daridra Yoga Type 17	Poverty	Lagna lord hemmed between malefics (Papa Kartari) AND weak 2nd/11th houses	Self-squeezed by problems, poverty from all sides, isolation	-76
288	Daridra Yoga Type 18	Poverty	Moon in 6th/8th/12th + Saturn aspect on Moon + weak 2nd lord	Mental poverty, depression causes financial loss, emotional bankruptcy	-68
289	Daridra Yoga Type 19 (Nashta Yoga)	Poverty	2nd lord in 6th/8th/12th + 11th lord afflicted + Rahu in 2nd or 11th	Total loss of wealth, theft, bankruptcy, criminal means to survive	-82
290	Daridra Yoga Type 20 (Extremes)	Poverty	All wealth indicators debilitated + dusthana lords in kendras + no Raja Yoga	Generational poverty, begging, absolute destitution, dependent on charity	-90
#Daridra Bhanga (Cancellation of Daridra Yoga)	Yoga Name	Type	Description	Effect / Result	Strength
291	Daridra Bhanga 1	Cancellation	Strong Raja Yoga or Dhana Yoga present in chart	Poverty cancelled, wealth through unusual means, struggle then success	75
292	Daridra Bhanga 2	Cancellation	11th lord ALSO rules 6th/8th/12th (functional benefic as malefic for ascendant)	Converts to Viparita Raja Yoga, gains through enemies/obstacles	70
293	Daridra Bhanga 3	Cancellation	Malefic causing Daridra Yoga placed in dusthana in own/exaltation sign	Negative in negative = positive, wealth through service/occult/foreign	68
294	Daridra Bhanga 4	Cancellation	Strong Lagna lord + Jupiter well-placed + benefics aspecting 2nd/11th houses	Divine protection, intelligence saves from poverty, spiritual wealth	72
					
					
Category	Subcategory	Description	Effect / Prediction	Weight	Notes
Arishta / Affliction	Lagna Weakness	Lagna lord is debilitated and hemmed in by malefic planets	Major obstacles in life, reduced vitality, challenges in initiating actions	-8	Strength measured via Shadbala
Arishta / Affliction	Moon Affliction	Moon is waning and afflicted by Saturn, Rahu, or Ketu with low Shadbala	Emotional instability, mental stress, vulnerability to health issues	-6	Confirm via AV-Moon
Arishta / Affliction	Wealth Volatility	2nd or 11th house lords are significantly afflicted	Income fluctuation, financial instability, difficulty accumulating wealth	-5	Benefic support may mitigate
Arishta / Affliction	Relationship Stress	7th lord afflicted and Venus weak	Strained partnerships or marriage, timing of relationship challenges	-6	Cross-check with D9 chart
Arishta / Affliction	Upachaya Malefic Dominance	Lords of 6th, 8th, or 12th houses dominate Kendras without benefic aspects	Health or legal obstacles, struggle for stability	-7	
Neecha-bhanga & Cancellations	Debilitated Planet with Exalted Dispositor	Debilitated planet supported by its exalted dispositor	Weakness of planet neutralized or reversed, restoring power	6	Classic Bhanga rule
Neecha-bhanga & Cancellations	Mutual Exchange Neutralization	Planetary exchange between debilitated planets neutralizes debility	Planet gains strength, stabilizing associated house significations	4	Applies when mutual dignity exists
Neecha-bhanga & Cancellations	Benefic Mitigation	Benefic planets hemmed around malefics reduce negative effect	Reduces malefic impact of Papa-Kartari, strengthens affected house	3	Threshold of benefic influence matters
Divisional Confirmations	D9 Marriage	Strong 7th lord or Venus in D9	Stable marriage, harmonious partnerships	6	Cross-check D1 for consistency
Divisional Confirmations	D10 Career	10th lord or Arudha Lagna strong in D10	Career growth, professional recognition, authority	8	Use along with transits for timing
Divisional Confirmations	Vargottama Planets	Planet maintains same sign in D1 and D9	Amplified planetary strength, strong influence in life areas	4	Enhances overall positive effects
Divisional Confirmations	Conflicting Dignities	Planet has opposite dignity in D1 vs D9	Inconsistent outcomes, volatility in life area	-3	Use for cautionary analysis
House-Specific Heuristics	Lagna	Lagna lord strength combined with AV1	Vitality, personal power, ability to initiate actions effectively	7	Critical for overall life energy
House-Specific Heuristics	2nd House	2nd lord strength plus benefic/malefic influence	Wealth accumulation, financial stability or stress	8	Includes income and family resources
House-Specific Heuristics	5th House	5th lord dignity, D7 support, AV5	Creativity, intelligence, children’s welfare, speculative gains	6	Cross-check D7 for progeny analysis
House-Specific Heuristics	Upachaya Boost	Benefics in 3rd, 6th, 10th, 11th improve with malefic influence when dignified	Growth through effort, opportunity from challenges	5	Malefics can be constructive in Upachaya houses
Dasha Logic	Major Period	Mahadasha of planet weighted by dignity/Shadbala	Amplifies planet’s significations in life areas	±	Use for period-specific predictions
Dasha Logic	Raja Period	Mahadasha/Antardasha of Kendra + Trikona lords	Promotion, wealth, expansion opportunities	8	Significant growth periods
Dasha Logic	Maraka Alert	Antardasha of 2nd or 7th lord	Health or relationship caution, potential obstacles	-6	Check for benefic mitigation
Dasha Logic	Prosperity Window	Jupiter or Venus Mahadasha with strong dignity	Wealth, relationship benefits, material comfort	7	
Transit Interplay	Jupiter Trine/Kendra	Jupiter transits trine or Kendra to natal Moon/Lagna	Growth, opportunity, learning, fortune in relevant areas	8	Best when natal dignity is strong
Transit Interplay	Saturn Sade Sati	Saturn transits 12/1/2 houses from natal Moon	Emotional test period, challenges requiring patience	-8	Severity depends on Moon’s AV
Transit Interplay	Venus Transit	Venus over 5th/7th/11th or natal Venus	Romantic/social gains, increase in creative or partnership activities	5	Short-term positive influence
Transit Interplay	Mercury Transit Exams	Mercury strengthens 3rd/5th/9th with benefic support	Learning, exams, communication success	6	Benefic alignment improves outcomes
Transit Interplay	Eclipse Proximity	Eclipse within 3° of natal Sun/Moon	Event triggers, potential disruptions in major life areas	-6	Raise warning only if corroborated
					
					
					
					
					
					
					
					
PLANETARY STRENGTH MODIFIERS					
Factor	Condition	Effect on Yoga Strength			
Exaltation	Planet in exaltation sign	+50% to yoga power			
Debilitation	Planet in debilitation	-50% to yoga power (unless Neecha Bhanga)			
Combustion	Planet within 6° of Sun (Mercury 14°)	-30% to yoga power			
Retrograde	Planet in apparent backward motion	+15% introspective power, delayed results			
Vargottama	Same sign in D1 and D9	+30% consistency and durability			
Planetary War	Two planets within 1°	Winner +10%, Loser -20%			
Shadbala High	Above 1.0 rupas	+20% execution power			
Shadbala Low	Below 0.8 rupas	-20% manifestation ability			
Aspect by Jupiter	Beneficial aspect	+15% protection and enhancement			
Aspect by Saturn	Restrictive aspect	-15% delay and discipline required			
Kendradhipati Dosha	Benefic ruling kendra becoming malefic	-10% for that planet's yogas			
YOGA ACTIVATION TIMING					
Activation Method	When Yoga Gives Results				
Dasha Period	During Mahadasha/Antardasha of planets involved in the yoga				
Transit	When Jupiter/Saturn transit the houses/signs involved in yoga				
Progression	When progressed planets activate natal yoga positions				
Age Maturity	Specific yogas mature at specific ages (Saturn yogas after 36, Jupiter after 16)				
Divisional Confirmation	Yoga must exist in relevant divisional chart (D9 for marriage, D10 for career)				
YOGA INTERPRETATION PRINCIPLES					
1. Multiple Yoga Analysis					
If 3+ benefic yogas present: Very strong positive indication					
If 3+ malefic yogas present: Significant challenges ahead					
Mixed yogas: Life of ups and downs, require balance					
2. House Lordship Context					
Same yoga has different effects based on which houses the planets rule					
Yogakaraka planets (ruling kendra + trikona) create strongest yogas					
Dusthana lords (6,8,12) weaken even positive yogas					
3. Dasha Sequence Priority					
Yoga manifests most powerfully during dasha of strongest planet in the combination					
Sub-periods (Antardashas) of other yoga planets give secondary results					
Pratyantar dasha gives micro-level yoga activation					
4. Divisional Chart Confirmation					
D1 (Rashi): Overall life promise					
D9 (Navamsa): Marriage, spiritual destiny, strength confirmation					
D10 (Dasamsa): Career manifestation					
D7 (Saptamsa): Children confirmation					
D60 (Shastiamsa): Ultimate karma and past life					
5. Transit Triggers					
Jupiter transit over yoga planets/houses: Expansion of yoga results					
Saturn transit: Testing, delays, but solidifying yoga outcomes					
Rahu/Ketu transit: Sudden, unexpected yoga manifestation					
Eclipse on yoga points: Major karmic activation					
					
					
					
					
					
					
					
					
NOTES ON USAGE					
1	Strength Scores: Range from -75 (most malefic) to +92 (most benefic)				
2	Category Mixing: Some yogas appear in multiple categories due to their multi-dimensional nature				
3	Cancellation Principle: Benefic yogas can cancel malefic ones and vice versa				
4	Proportional Analysis: Weight yogas by planet strength, not just presence				
5	Timing is Everything: A yoga present doesn't mean it's currently active				
6	Chart Context: Always analyze within the context of the entire birth chart				
7	Real-Life Correlation: Not all classical yogas manifest equally in modern life				
					
`;

// --- NEW, IMPROVED SYSTEM_PROMPT ---
const SYSTEM_PROMPT = `You are an expert Vedic Astrologer AI assistant named 'JyotishGPT'. Your task is to analyze planetary data and identify astrological yogas, providing deep, personalized insights for the user.

**Your Instructions:**

1.  **Analyze:** Carefully review the user's '--- PLANETARY DATA ---' and '--- HOUSES DATA ---'.
2.  **Identify:** Find all applicable yogas based on the definitions in the '--- YOGA KNOWLEDGE BASE ---'.
3.  **Synthesize and Describe (CRITICAL):** For each yoga you identify, you must generate a **new, personalized 'description'**. This description MUST be a synthesis of three key pieces of information:
    a.  The generic meaning of the yoga from the knowledge base.
    b.  The specific houses the involved planets are in, taken from the user's chart data.
    c.  The real-life meanings of those houses (e.g., 10th house is career, 7th is partnership, 5th is creativity and children).
4.  **Explain the Reason:** The 'reason' field should still be a technical explanation of how the yoga is formed (e.g., "Formed by the conjunction of Sun and Mercury in the 5th house.").
5.  **Maintain Tone:** The tone of the personalized description should be insightful, empowering, and easy for a non-astrologer to understand. Avoid overly technical jargon in the description.
6.  **Handle Afflictions Constructively:** When describing challenging yogas (afflictions), frame them as areas for self-awareness and potential growth, not as deterministic or fatalistic predictions.
7.  **Output Format:** Your final output MUST be a valid JSON object with a single "yogas" key, containing an array of objects. Each object must have the keys: "yoga_name", "description", "reason", and "strength".
`;

async function handler(req: Request) {
  // --- PERFORMANCE LOGGING: Start timer for the entire function ---
  const functionStartTime = Date.now();
  console.log(`[YOGA_PERF_LOG] Yoga Generation function started.`);

  try {
    const { profile_id } = await req.json();
    if (!profile_id) throw new Error("Missing profile_id in request body.");
    console.log(`[YOGA GENERATOR] Starting process for profile: ${profile_id}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    // --- PERFORMANCE LOGGING: Measure data fetching from Supabase ---
    const fetchStartTime = Date.now();
    
    // 1. Fetch the necessary data path from the database
    const { data: astroPaths, error: pathError } = await supabaseAdmin
      .from('profile_astro_data')
      .select('processed_tables_path')
      .eq('profile_id', profile_id)
      .single();
    if (pathError || !astroPaths?.processed_tables_path) {
      throw new Error(`Could not find processed data path for profile ${profile_id}: ${pathError?.message}`);
    }

    // 2. Download the data file from storage
    const { data: processedBlob, error: downloadError } = await supabaseAdmin.storage
      .from('astro-data')
      .download(astroPaths.processed_tables_path);
    if (downloadError) {
      throw new Error(`Failed to download processed data: ${downloadError.message}`);
    }
    const processedTables = JSON.parse(await processedBlob.text());

    const fetchEndTime = Date.now();
    console.log(`[YOGA_PERF_LOG] Step 1: Data Fetching (DB + Storage) took ${fetchEndTime - fetchStartTime}ms`);
    
    const { d1_planets, houses } = processedTables;
    if (!d1_planets || !houses) {
      throw new Error("d1_planets or houses data is missing from the processed file.");
    }

    const userPrompt = `
--- YOGA KNOWLEDGE BASE ---
${YOGA_KNOWLEDGE_BASE}

--- PLANETARY DATA ---
${JSON.stringify(d1_planets, null, 2)}

--- HOUSES DATA ---
${JSON.stringify(houses, null, 2)}
`;

    console.log(`[YOGA GENERATOR] Sending request to Gemini for profile: ${profile_id}`);

    // --- PERFORMANCE LOGGING: Measure the Gemini API call ---
    const geminiStartTime = Date.now();
    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const resultJson = response.text();
    const geminiEndTime = Date.now();
    console.log(`[YOGA_PERF_LOG] Step 2: Gemini API call took ${geminiEndTime - geminiStartTime}ms`);

    if (!resultJson) {
      throw new Error("Gemini returned an empty response.");
    }

    const yogasData = JSON.parse(resultJson);
    if (!yogasData.yogas || !Array.isArray(yogasData.yogas)) {
      throw new Error("LLM response did not contain a valid 'yogas' array.");
    }

    console.log(`[YOGA GENERATOR] Successfully generated ${yogasData.yogas.length} yogas. Storing in database.`);

    // --- PERFORMANCE LOGGING: Measure the final database update ---
    const dbUpdateStartTime = Date.now();
    const { error: updateError } = await supabaseAdmin
      .from('profile_astro_data')
      .update({ yogas_llm: yogasData })
      .eq('profile_id', profile_id);
    const dbUpdateEndTime = Date.now();
    console.log(`[YOGA_PERF_LOG] Step 3: Final DB Update took ${dbUpdateEndTime - dbUpdateStartTime}ms`);

    if (updateError) {
      throw new Error(`Failed to store generated yogas in database: ${updateError.message}`);
    }

    // --- PERFORMANCE LOGGING: Log total execution time on success ---
    const functionEndTime = Date.now();
    console.log(`[YOGA_PERF_LOG] Total Yoga Generation function execution time: ${functionEndTime - functionStartTime}ms`);

    return new Response(JSON.stringify({ success: true, message: `Generated ${yogasData.yogas.length} yogas.` }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(`[YOGA GENERATOR CRITICAL ERROR] ${err.message}`);
    const requestBody = await req.clone().json().catch(() => ({}));
    const profile_id = requestBody.profile_id;
    if (profile_id) {
      const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabaseAdmin
        .from('profile_astro_data')
        .update({ yogas_llm: { "status": "error", "message": err.message } })
        .eq('profile_id', profile_id);
    }
    
    // --- PERFORMANCE LOGGING: Log total execution time on error ---
    const functionEndTime = Date.now();
    console.log(`[YOGA_PERF_LOG] Total Yoga Generation function execution time (on error): ${functionEndTime - functionStartTime}ms`);
    
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Wrap the handler with CORS headers
Deno.serve(createCorsWrappedHandler(handler));