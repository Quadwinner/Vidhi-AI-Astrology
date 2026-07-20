# Requirements Document

## Introduction

This document specifies a suite of five Vedic astrology features for the Vidhi (AuraAI) platform, discovered through market research of leading apps (AstroSage, Astrotalk, Astroyogi, Cosmic Insights). All five features are backed by the existing VedicAstroAPI plan (JSON data endpoints under `https://api.vedicastroapi.com/v3-json`, authenticated via the `VEDICASTRO_API_KEY` secret) and reuse the platform's established patterns: Deno Edge Functions wrapped with `createCorsWrappedHandler`, frontend calls via `supabase.functions.invoke`, the Tarot monetization model (premium free-allowance + per-use wallet charge, charged only after a successful upstream call), admin-controlled pricing via the Price Manager (`service_prices` table) and free allowances via the `settings` table, and themed standalone pages linked from the Navbar.

The five features, in priority order:

1. **Kundli Matching / Guna Milan** (Ashtakoot 36-point) — highest priority
2. **Daily Panchang + Choghadiya / Shubh Muhurat** — highest priority (daily-engagement driver)
3. **Dosha Detection + Remedies** (Manglik, Kaal Sarp, Pitru, Sade Sati)
4. **Numerology Report**
5. **Gemstone & Rudraksha Recommendation**

The document also defines cross-cutting requirements for monetization/gating, admin control, navigation, error handling, and internationalization that apply across all five features.

## Glossary

- **Suite**: The collection of five astrology features specified in this document.
- **Kundli_Matching_Service**: The backend edge function and logic that computes Ashtakoot Guna Milan compatibility between two sets of birth details.
- **Panchang_Service**: The backend edge function and logic that returns daily Panchang, Choghadiya, and Muhurat data for a date and location.
- **Dosha_Service**: The backend edge function and logic that detects Manglik, Kaal Sarp, Pitru, and Sade Sati doshas and returns effects and remedies.
- **Numerology_Service**: The backend edge function and logic that produces a numerology report from a name and date of birth.
- **Gemstone_Service**: The backend edge function and logic that returns gemstone and Rudraksha recommendations from birth details.
- **Feature_Service**: Any one of the five backend services above, when a requirement applies to all of them.
- **Feature_Page**: Any one of the five themed standalone frontend pages, one per feature.
- **VedicAstro_API**: The external provider at `https://api.vedicastroapi.com/v3-json`, authenticated by the `VEDICASTRO_API_KEY` secret.
- **User**: An authenticated end user of the platform, identified by a Supabase auth session.
- **Premium_User**: A User whose `users.subscription_status` equals `'active'`.
- **Non_Premium_User**: A User whose `users.subscription_status` is not `'active'`.
- **Wallet_Balance**: The `users.wallet_balance` value, stored in minor currency units and displayed by dividing by 100.
- **Service_Price**: A row in the `service_prices` table keyed by `service_key`, `currency_code`, and `variant_name`, expressed in minor currency units.
- **Free_Allowance**: The per-feature count of free uses available to Premium_Users, stored as a value in the `settings` table under a per-feature key.
- **Free_Allowance_Used**: The count of a User's consumed free uses for a given feature.
- **Admin**: A User with administrative access (DB `is_admin` flag or email allowlist) who can edit prices and free allowances.
- **Price_Manager**: The admin UI component (`PriceManager.tsx`) that edits `service_prices` rows for services listed in `USAGE_SERVICES`.
- **Birth_Details**: A record containing date of birth, time of birth, birth place, latitude, longitude, timezone, gender, and name, sourced from `user_birth_details` or entered by the User.
- **Navbar**: The desktop and mobile navigation component through which Feature_Pages are reached.
- **Language_Preference**: The User's selected output language, either English (`en`) or Hindi (`hi`).

## Requirements

### Requirement 1: Kundli Matching / Guna Milan (Ashtakoot 36-point)

**User Story:** As a User seeking marriage compatibility, I want to match my birth details against a partner's birth details, so that I can see the Ashtakoot 36-point Guna Milan score and compatibility breakdown.

#### Acceptance Criteria

1. WHEN a User submits two complete sets of Birth_Details for matching, THE Kundli_Matching_Service SHALL call the VedicAstro_API `matching/ashtakoot` endpoint and return the total Guna score out of 36 with the per-koota breakdown.
2. WHERE the User has a saved profile with Birth_Details, THE Kundli_Matching_Service SHALL accept the User's profile Birth_Details as the first party and the partner's entered Birth_Details as the second party.
3. WHEN converting a stored date of birth to the VedicAstro_API request format, THE Kundli_Matching_Service SHALL send the date as `DD/MM/YYYY`.
4. IF either set of submitted Birth_Details is missing date of birth, time of birth, latitude, longitude, or timezone, THEN THE Kundli_Matching_Service SHALL return a validation error identifying the missing field and SHALL NOT call the VedicAstro_API.
5. WHEN the VedicAstro_API returns a successful Ashtakoot response, THE Kundli_Matching_Service SHALL return the available fields among the total score, the individual koota scores, and the provider's compatibility conclusion to the Feature_Page as a successful partial response.
6. THE Kundli_Matching_Service Feature_Page SHALL display the total Guna score, the per-koota breakdown, and a plain-language compatibility summary.

### Requirement 2: Daily Panchang + Choghadiya / Shubh Muhurat

**User Story:** As a User planning my day, I want the daily Panchang and auspicious/inauspicious time slots for my location, so that I can choose favorable times for activities.

#### Acceptance Criteria

1. WHEN a User requests the Panchang for a given date and location, THE Panchang_Service SHALL call the VedicAstro_API `panchang` endpoint and return tithi, nakshatra, yoga, karana, sunrise, and sunset.
2. WHEN a User requests auspicious time slots for a given date and location, THE Panchang_Service SHALL call the VedicAstro_API `choghadiya` endpoint and return the day and night Choghadiya slots with each slot's auspicious or inauspicious classification.
3. WHERE a User requests Muhurat timings, THE Panchang_Service SHALL call the VedicAstro_API `hora-muhurat` endpoint and return the Hora and Muhurat slots for the requested date and location.
4. IF a request for Panchang data omits the date, latitude, longitude, or timezone, THEN THE Panchang_Service SHALL default the date to the current date in the requested timezone and SHALL return a validation error when latitude, longitude, or timezone is missing.
5. THE Panchang_Service Feature_Page SHALL display tithi, nakshatra, yoga, karana, sunrise, sunset, and the Choghadiya slots with auspicious and inauspicious slots visually distinguished.
6. WHEN a User views the Panchang_Service Feature_Page without selecting a date, THE Feature_Page SHALL display the current day's Panchang for the User's location.

### Requirement 3: Dosha Detection + Remedies

**User Story:** As a User concerned about doshas, I want to know whether Manglik, Kaal Sarp, Pitru, or Sade Sati doshas apply to my chart along with effects and remedies, so that I can understand and address them.

#### Acceptance Criteria

1. WHEN a User submits Birth_Details for dosha analysis, THE Dosha_Service SHALL call the VedicAstro_API `manglik`, `kaalsarp`, and `pitra` dosh endpoints and return a yes/no presence indicator, effects, and remedies for each dosha.
2. WHEN a User submits Birth_Details for Sade Sati analysis, THE Dosha_Service SHALL call the VedicAstro_API current Sade Sati endpoint and return the current Sade Sati status, effects, and remedies.
3. IF the submitted Birth_Details are missing date of birth, time of birth, latitude, longitude, or timezone, THEN THE Dosha_Service SHALL return a validation error identifying the missing field and SHALL NOT call the VedicAstro_API.
4. WHEN one or more dosha endpoints return an error, THE Dosha_Service SHALL return the successful dosha results together with a per-dosha error indicator for each failed dosha, including the case where every dosha endpoint fails.
5. THE Dosha_Service Feature_Page SHALL display each dosha with its presence indicator, effects, and remedies grouped by dosha.

### Requirement 4: Numerology Report

**User Story:** As a User interested in numerology, I want a report based on my name and date of birth, so that I can learn my lucky number, ruling planet, and predictions.

#### Acceptance Criteria

1. WHEN a User submits a name and date of birth for a numerology report, THE Numerology_Service SHALL call the VedicAstro_API `numerology` endpoint and return the lucky number, ruling planet, and predictions.
2. IF the submitted request is missing the name or the date of birth, THEN THE Numerology_Service SHALL return a validation error identifying the missing field and SHALL NOT call the VedicAstro_API.
3. WHEN the VedicAstro_API returns a successful numerology response, THE Numerology_Service SHALL return the lucky number, ruling planet, and prediction text to the Feature_Page.
4. THE Numerology_Service Feature_Page SHALL display the lucky number, ruling planet, and predictions.

### Requirement 5: Gemstone & Rudraksha Recommendation

**User Story:** As a User seeking remedial guidance, I want personalized gemstone and Rudraksha recommendations based on my birth details, so that I know which stones and beads suit my chart.

#### Acceptance Criteria

1. WHEN a User submits Birth_Details for a gemstone recommendation, THE Gemstone_Service SHALL call the VedicAstro_API `gem-suggestion` endpoint and return the recommended gemstones with their associated details.
2. WHEN a User submits Birth_Details for a Rudraksha recommendation, THE Gemstone_Service SHALL call the VedicAstro_API `rudraksh-suggestion` endpoint and return the recommended Rudraksha with its associated details.
3. IF the submitted Birth_Details are missing date of birth, time of birth, latitude, longitude, or timezone, THEN THE Gemstone_Service SHALL return a validation error identifying the missing field and SHALL NOT call the VedicAstro_API.
4. THE Gemstone_Service Feature_Page SHALL display the recommended gemstones and Rudraksha with their associated details.

### Requirement 6: Monetization and Access Gating

**User Story:** As a product owner, I want each feature to follow the Tarot monetization model, so that premium members get free allowances and other users are charged per use.

#### Acceptance Criteria

1. WHERE a User is a Premium_User and that User's Free_Allowance_Used for a feature is less than the feature's Free_Allowance, THE Feature_Service SHALL serve the request as a free use and increment Free_Allowance_Used only after a successful VedicAstro_API call.
2. WHERE a User is a Non_Premium_User, or a Premium_User whose Free_Allowance_Used has reached the Free_Allowance, THE Feature_Service SHALL charge the feature's Service_Price for the User's `currency_code`.
3. WHEN a Feature_Service charges a Service_Price, THE Feature_Service SHALL deduct the price from Wallet_Balance only after a successful VedicAstro_API call.
4. IF a charged request has a Wallet_Balance less than the feature's Service_Price, THEN THE Feature_Service SHALL return HTTP 402 with the required amount, current balance, currency, and a recharge prompt, and SHALL NOT call the VedicAstro_API.
5. IF the Service_Price for a feature and the User's `currency_code` does not exist, THEN THE Feature_Service SHALL return an error and SHALL NOT charge Wallet_Balance.
6. WHEN a VedicAstro_API call fails or returns an unsuccessful status, THE Feature_Service SHALL neither deduct Wallet_Balance nor increment Free_Allowance_Used.
7. WHEN a Feature_Service completes a request, THE Feature_Service SHALL return whether the use was charged, the amount charged, the currency, the updated Wallet_Balance, and the remaining Free_Allowance.

### Requirement 7: Admin Control of Pricing and Free Allowances

**User Story:** As an Admin, I want to configure each feature's per-use price and premium free allowance, so that I can manage monetization without code changes.

#### Acceptance Criteria

1. THE Price_Manager SHALL list each of the five features as an editable usage service in `USAGE_SERVICES` with a distinct `service_key`.
2. WHEN an Admin sets a price for a feature in a supported currency, THE Price_Manager SHALL persist the value to the `service_prices` table for that `service_key` and `currency_code` in minor currency units.
3. THE Suite SHALL seed a default Service_Price for each feature's `service_key` in every supported currency (INR, USD, AED) via a database migration.
4. WHERE an Admin sets a feature's Free_Allowance, THE Suite SHALL persist the value to the `settings` table under that feature's dedicated key.
5. WHEN a feature's Free_Allowance key is absent from the `settings` table, THE Feature_Service SHALL apply a defined default Free_Allowance for that feature.
6. WHERE an Admin sets a feature's Free_Allowance, THE Suite SHALL enforce a minimum Free_Allowance of 1 so that every feature retains at least one free use for Premium_Users.

### Requirement 8: Navigation

**User Story:** As a User, I want to reach each feature from the app navigation, so that I can discover and open the features easily.

#### Acceptance Criteria

1. THE Navbar SHALL provide a navigation link to each Feature_Page in both the desktop and mobile layouts.
2. WHEN a User activates a Feature_Page navigation link, THE Suite SHALL route the User to the corresponding Feature_Page via an App.tsx route.
3. THE Suite SHALL render each Feature_Page using the brand theme (background `#0d0c0b`, maroon `#61072B`, gold `#E5B45B`, cream `#E5E2DF`, Playfair Display and Inter typography) consistent with the Rashifal and Tarot pages.

### Requirement 9: Error Handling

**User Story:** As a User, I want clear feedback when something goes wrong, so that I understand what happened and can retry.

#### Acceptance Criteria

1. IF a VedicAstro_API call fails, times out, or returns an unsuccessful status, THEN THE Feature_Service SHALL return a source-unavailable message and SHALL NOT charge Wallet_Balance.
2. IF a User request lacks a valid authentication session, THEN THE Feature_Service SHALL return HTTP 401.
3. WHEN a Feature_Service returns an error, THE Feature_Page SHALL display a human-readable message and SHALL allow the User to retry.
4. THE Feature_Service SHALL apply a request timeout to each VedicAstro_API call so that a slow provider does not block the response indefinitely.

### Requirement 10: Internationalization

**User Story:** As a Hindi-speaking User, I want feature output in Hindi where the provider supports it, so that I can read results in my preferred language.

#### Acceptance Criteria

1. WHERE a User selects a Language_Preference of Hindi and the VedicAstro_API endpoint supports the `lang` parameter with Hindi, THE Feature_Service SHALL send `lang=hi` to the VedicAstro_API.
2. IF a User selects a Language_Preference of Hindi and the VedicAstro_API endpoint does not support Hindi, THEN THE Feature_Service SHALL send `lang=en` as a fallback.
3. WHERE a User selects a Language_Preference of English, THE Feature_Service SHALL send `lang=en` to the VedicAstro_API.
4. WHERE a Feature_Page provides a language toggle, THE Feature_Page SHALL request updated data in the selected Language_Preference when the toggle changes.
