

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE TYPE "public"."plan_tier_enum" AS ENUM (
    'free',
    'monthly',
    'yearly'
);


ALTER TYPE "public"."plan_tier_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."plan_tier_enum" IS 'Defines the access levels for users: free, monthly, or yearly subscribers.';



CREATE TYPE "public"."subscription_currency" AS ENUM (
    'inr',
    'usd',
    'aed',
    'gbp'
);


ALTER TYPE "public"."subscription_currency" OWNER TO "postgres";


CREATE TYPE "public"."subscription_interval" AS ENUM (
    'month',
    'year'
);


ALTER TYPE "public"."subscription_interval" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'canceled',
    'past_due',
    'incomplete'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_chats"() RETURNS TABLE("profile_id" "uuid", "profile_name" character varying, "last_message_content" "text", "last_message_timestamp" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT
            ch.profile_id,
            ch.message_content,
            ch.created_at,
            ROW_NUMBER() OVER(PARTITION BY ch.profile_id ORDER BY ch.created_at DESC) as rn
        FROM chat_history ch
        JOIN user_profiles up ON ch.profile_id = up.id
        WHERE up.user_id = auth.uid()
    )
    SELECT
        lm.profile_id,
        up.name as profile_name, -- This now correctly matches the function's return type
        LEFT(lm.message_content, 50) as last_message_content,
        lm.created_at as last_message_timestamp
    FROM latest_messages lm
    JOIN user_profiles up ON lm.profile_id = up.id
    WHERE lm.rn = 1
    ORDER BY lm.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_recent_chats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_setup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert a row into our public.users table for the new user,
  -- giving them the default starting coin balance.
  INSERT INTO public.users (id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_setup"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user_setup"() IS 'Creates an entry in the public.users table for a new user to grant them their initial coin balance.';



CREATE OR REPLACE FUNCTION "public"."match_astro_chunks"("profile_id_input" "uuid", "query_embedding" "extensions"."vector", "match_count" integer DEFAULT 15) RETURNS TABLE("content" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    vec.content
  FROM
    public.vectored_astro_data AS vec
  WHERE
    vec.profile_id = profile_id_input
  ORDER BY
    vec.embedding <=> query_embedding -- The magical cosine distance operator
  LIMIT
    match_count;
$$;


ALTER FUNCTION "public"."match_astro_chunks"("profile_id_input" "uuid", "query_embedding" "extensions"."vector", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_subscription"("p_user_id" "uuid", "p_price_id" bigint, "p_gateway_subscription_id" "text", "p_management_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_plan_interval public.subscription_interval;
    v_plan_tier public.plan_tier_enum;
    v_current_period_start TIMESTAMPTZ;
    v_current_period_end TIMESTAMPTZ;
BEGIN
    -- Step 1: Get plan interval (no changes here)
    SELECT "interval" INTO v_plan_interval
    FROM public.subscription_plans
    WHERE id = (SELECT plan_id FROM public.prices WHERE id = p_price_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan not found for price_id %', p_price_id;
    END IF;

    -- Step 2: Determine tier and billing period (no changes here)
    IF v_plan_interval = 'month' THEN
        v_plan_tier := 'monthly';
        v_current_period_start := NOW();
        v_current_period_end := NOW() + interval '1 month';
    ELSIF v_plan_interval = 'year' THEN
        v_plan_tier := 'yearly';
        v_current_period_start := NOW();
        v_current_period_end := NOW() + interval '1 year';
    ELSE
        RAISE EXCEPTION 'Invalid plan interval %', v_plan_interval;
    END IF;

    -- Step 3: Deactivate any other active subscriptions for this user.
    -- *** THIS IS THE FIX ***
    -- Changed 'cancelled' (two 'l's) to 'canceled' (one 'l') to match your enum.
    UPDATE public.users_subscriptions
    SET status = 'canceled'
    WHERE
        user_id = p_user_id AND
        status IN ('active', 'past_due');

    -- Step 4: Insert the new subscription record (no changes here)
    INSERT INTO public.users_subscriptions (
        user_id,
        price_id,
        status,
        gateway_subscription_id,
        current_period_start,
        current_period_end,
        management_url
    ) VALUES (
        p_user_id,
        p_price_id,
        'active',
        p_gateway_subscription_id,
        v_current_period_start,
        v_current_period_end,
        p_management_url
    );
        
    -- Step 5: Update the user's tier in the `users` table (no changes here)
    UPDATE public.users
    SET plan_tier = v_plan_tier
    WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_user_subscription"("p_user_id" "uuid", "p_price_id" bigint, "p_gateway_subscription_id" "text", "p_management_url" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_generated_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "questions_json" "jsonb",
    "last_generated_at" timestamp with time zone,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."ai_generated_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_generated_questions" IS 'Caches the personalized, AI-generated "starter" questions for a user''s profile.';



COMMENT ON COLUMN "public"."ai_generated_questions"."user_id" IS 'Denormalized user_id for easier RLS policies.';



CREATE TABLE IF NOT EXISTS "public"."call_feedback" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comments" "text",
    CONSTRAINT "call_feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."call_feedback" OWNER TO "postgres";


COMMENT ON TABLE "public"."call_feedback" IS 'Stores user feedback for AI calls.';



COMMENT ON COLUMN "public"."call_feedback"."rating" IS 'User rating for the call, from 1 to 5.';



ALTER TABLE "public"."call_feedback" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."call_feedback_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."chat_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_content" "text" NOT NULL,
    "role" "text" NOT NULL,
    "is_custom_question" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "feedback" "text",
    "language" "text" DEFAULT 'en'::"text",
    "tts_content" "text",
    CONSTRAINT "chat_history_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."chat_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_history" IS 'Stores the chronological history of questions and answers for a profile chat.';



COMMENT ON COLUMN "public"."chat_history"."role" IS 'Indicates whether the message is from the user or the AI assistant.';



COMMENT ON COLUMN "public"."chat_history"."is_custom_question" IS 'True if the user typed the question manually.';



CREATE TABLE IF NOT EXISTS "public"."collected_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    CONSTRAINT "proper_email" CHECK (("email" ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'::"text"))
);


ALTER TABLE "public"."collected_emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."collected_emails" IS 'Stores email addresses collected from the homepage CTA.';



CREATE TABLE IF NOT EXISTS "public"."global_planet_transits" (
    "id" bigint NOT NULL,
    "planet_name" "text" NOT NULL,
    "year" smallint NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "zodiac_sign" "text" NOT NULL,
    "is_retrograde" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."global_planet_transits" OWNER TO "postgres";


COMMENT ON TABLE "public"."global_planet_transits" IS 'Stores universal planetary transit data, cached yearly.';



ALTER TABLE "public"."global_planet_transits" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."global_planet_transits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."prices" (
    "id" bigint NOT NULL,
    "plan_id" "text" NOT NULL,
    "amount" integer NOT NULL,
    "currency" "public"."subscription_currency" NOT NULL,
    "gateway_price_id" "text"
);


ALTER TABLE "public"."prices" OWNER TO "postgres";


COMMENT ON TABLE "public"."prices" IS 'Stores the price for each plan in different currencies.';



ALTER TABLE "public"."prices" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."prices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profile_astro_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "analyst_report" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_generated_at" timestamp with time zone DEFAULT "now"(),
    "chart_data_path" "text",
    "processed_tables_path" "text",
    "vimshottari_dasha" "jsonb"
);


ALTER TABLE "public"."profile_astro_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."profile_astro_data" IS 'Caches the expensive astrological data and AI insights for a user profile.';



COMMENT ON COLUMN "public"."profile_astro_data"."profile_id" IS 'Links to a specific user profile.';



COMMENT ON COLUMN "public"."profile_astro_data"."analyst_report" IS 'Stores the text/markdown report from the Analyst AI agent.';



CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "interval" "public"."subscription_interval" NOT NULL
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_plans" IS 'Stores the different subscription tiers like Pro Monthly or Pro Yearly.';



CREATE TABLE IF NOT EXISTS "public"."system_prompts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prompt_name" "text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "description" "text",
    "api_provider" "text" DEFAULT 'openai'::"text",
    "model_name" "text" DEFAULT 'gpt-4o'::"text",
    "secret_name" "text" DEFAULT 'OPENAI_API_KEY'::"text"
);


ALTER TABLE "public"."system_prompts" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_prompts" IS 'Stores version-controlled system prompts for the AI.';



COMMENT ON COLUMN "public"."system_prompts"."prompt_name" IS 'The stable, logical identifier for a prompt (e.g., voice_call_default).';



COMMENT ON COLUMN "public"."system_prompts"."version" IS 'Tracks iterations of a specific prompt_name.';



COMMENT ON COLUMN "public"."system_prompts"."is_active" IS 'If true, this is the live version of the prompt.';



COMMENT ON COLUMN "public"."system_prompts"."api_provider" IS 'The AI provider to use, e.g., ''openai'', ''google''';



COMMENT ON COLUMN "public"."system_prompts"."model_name" IS 'The specific model identifier, e.g., ''gpt-4o'', ''claude-3-sonnet''';



COMMENT ON COLUMN "public"."system_prompts"."secret_name" IS 'The name of the Supabase secret holding the API key.';



CREATE TABLE IF NOT EXISTS "public"."user_birth_details" (
    "id" bigint NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "time_of_birth" time without time zone,
    "birth_timezone" character varying(64),
    "birth_place" character varying(255),
    "birth_lat" character varying(50),
    "birth_lng" character varying(50),
    "gender" character varying(50),
    "timezone_offset" double precision
);


ALTER TABLE "public"."user_birth_details" OWNER TO "postgres";


ALTER TABLE "public"."user_birth_details" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_birth_details_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS 'Stores multiple profiles per user account.';



COMMENT ON COLUMN "public"."user_profiles"."id" IS 'Unique identifier for a single profile.';



COMMENT ON COLUMN "public"."user_profiles"."user_id" IS 'The account owner from auth.users.';



COMMENT ON COLUMN "public"."user_profiles"."name" IS 'User-defined name for the profile (e.g., "Me", "My Son").';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "coin_balance" integer DEFAULT 5 NOT NULL,
    "plan_tier" "public"."plan_tier_enum" DEFAULT 'free'::"public"."plan_tier_enum" NOT NULL,
    "gateway_customer_id" "text",
    "subscription_status" "text" DEFAULT 'inactive'::"text",
    "subscription_id" "text",
    "subscription_start_date" timestamp with time zone,
    "subscription_end_date" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Stores public user data that is not on a profile, like coin balance.';



COMMENT ON COLUMN "public"."users"."plan_tier" IS 'Stores the current subscription tier of the user. Defaults to free for new users.';



COMMENT ON COLUMN "public"."users"."gateway_customer_id" IS 'Stores the unique customer ID from the payment gateway (Stripe, Razorpay, etc.).';



CREATE TABLE IF NOT EXISTS "public"."users_subscriptions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "price_id" bigint NOT NULL,
    "status" "public"."subscription_status" NOT NULL,
    "current_period_start" timestamp with time zone NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "gateway_subscription_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "management_url" "text"
);


ALTER TABLE "public"."users_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."users_subscriptions" IS 'Tracks the active subscription for each user.';



ALTER TABLE "public"."users_subscriptions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."users_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."vectored_astro_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "extensions"."vector"(1536) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."vectored_astro_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."vectored_astro_data" IS 'Stores chunked astrological data and their vector embeddings for RAG.';



COMMENT ON COLUMN "public"."vectored_astro_data"."expires_at" IS 'Timestamp for when this data chunk becomes stale. NULL means it never expires.';



ALTER TABLE ONLY "public"."ai_generated_questions"
    ADD CONSTRAINT "ai_generated_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_generated_questions"
    ADD CONSTRAINT "ai_generated_questions_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."call_feedback"
    ADD CONSTRAINT "call_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collected_emails"
    ADD CONSTRAINT "collected_emails_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."collected_emails"
    ADD CONSTRAINT "collected_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_planet_transits"
    ADD CONSTRAINT "global_planet_transits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_gateway_price_id_key" UNIQUE ("gateway_price_id");



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_plan_id_currency_key" UNIQUE ("plan_id", "currency");



ALTER TABLE ONLY "public"."profile_astro_data"
    ADD CONSTRAINT "profile_astro_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_astro_data"
    ADD CONSTRAINT "profile_astro_data_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_prompts"
    ADD CONSTRAINT "system_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_birth_details"
    ADD CONSTRAINT "user_birth_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_birth_details"
    ADD CONSTRAINT "user_birth_details_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_gateway_customer_id_unique" UNIQUE ("gateway_customer_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users_subscriptions"
    ADD CONSTRAINT "users_subscriptions_gateway_subscription_id_key" UNIQUE ("gateway_subscription_id");



ALTER TABLE ONLY "public"."users_subscriptions"
    ADD CONSTRAINT "users_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users_subscriptions"
    ADD CONSTRAINT "users_subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."vectored_astro_data"
    ADD CONSTRAINT "vectored_astro_data_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_chat_history_profile_id" ON "public"."chat_history" USING "btree" ("profile_id");



CREATE INDEX "idx_transit_dates" ON "public"."global_planet_transits" USING "btree" ("start_date", "end_date");



CREATE UNIQUE INDEX "one_active_prompt_per_name" ON "public"."system_prompts" USING "btree" ("prompt_name") WHERE ("is_active" = true);



CREATE INDEX "vectored_astro_data_embedding_idx" ON "public"."vectored_astro_data" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops") WITH ("lists"='100');



ALTER TABLE ONLY "public"."ai_generated_questions"
    ADD CONSTRAINT "ai_generated_questions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_generated_questions"
    ADD CONSTRAINT "ai_generated_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_feedback"
    ADD CONSTRAINT "call_feedback_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."call_feedback"
    ADD CONSTRAINT "call_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_astro_data"
    ADD CONSTRAINT "fk_user_profile" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vectored_astro_data"
    ADD CONSTRAINT "fk_user_profile" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prices"
    ADD CONSTRAINT "prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."user_birth_details"
    ADD CONSTRAINT "user_birth_details_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users_subscriptions"
    ADD CONSTRAINT "users_subscriptions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "public"."prices"("id");



ALTER TABLE ONLY "public"."users_subscriptions"
    ADD CONSTRAINT "users_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "users_subscriptions_user_id_fkey" ON "public"."users_subscriptions" IS 'Ensures that every subscription is linked to a valid user.';



CREATE POLICY "Allow individual read access for subscriptions" ON "public"."users_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow individual read access for users" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Allow individual user insert access" ON "public"."profile_astro_data" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = "profile_astro_data"."profile_id") AND ("up"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow individual user read access" ON "public"."profile_astro_data" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = "profile_astro_data"."profile_id") AND ("up"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow individual user update access" ON "public"."profile_astro_data" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = "profile_astro_data"."profile_id") AND ("up"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow public email submissions" ON "public"."collected_emails" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access for plans" ON "public"."subscription_plans" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for prices" ON "public"."prices" FOR SELECT USING (true);



CREATE POLICY "Allow service role read access" ON "public"."system_prompts" FOR SELECT USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Allow user to manage their own chat history" ON "public"."chat_history" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow user to manage their own generated questions" ON "public"."ai_generated_questions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to create their own profiles" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to delete birth details of their own profiles" ON "public"."user_birth_details" FOR DELETE USING ((( SELECT "user_profiles"."user_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "user_birth_details"."profile_id")) = "auth"."uid"()));



CREATE POLICY "Allow users to delete chunks for their own profiles" ON "public"."vectored_astro_data" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "vectored_astro_data"."profile_id") AND ("user_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to delete their own profiles" ON "public"."user_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to insert birth details for their own profiles" ON "public"."user_birth_details" FOR INSERT WITH CHECK ((( SELECT "user_profiles"."user_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "user_birth_details"."profile_id")) = "auth"."uid"()));



CREATE POLICY "Allow users to insert chunks for their own profiles" ON "public"."vectored_astro_data" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "vectored_astro_data"."profile_id") AND ("user_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to insert their own feedback" ON "public"."call_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to read birth details of their own profiles" ON "public"."user_birth_details" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "user_birth_details"."profile_id") AND ("user_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to read their own profiles" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to select their own profile chunks" ON "public"."vectored_astro_data" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "vectored_astro_data"."profile_id") AND ("user_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to update birth details of their own profiles" ON "public"."user_birth_details" FOR UPDATE USING ((( SELECT "user_profiles"."user_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."id" = "user_birth_details"."profile_id")) = "auth"."uid"()));



CREATE POLICY "Allow users to update their own profiles" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to view their own feedback" ON "public"."call_feedback" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read access for authenticated users" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



COMMENT ON POLICY "Enable read access for authenticated users" ON "public"."users" IS 'Users can view their own user data (e.g., plan_tier, coin_balance).';



CREATE POLICY "Enable read access for authenticated users' subscriptions" ON "public"."users_subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



COMMENT ON POLICY "Enable read access for authenticated users' subscriptions" ON "public"."users_subscriptions" IS 'Users can view their own subscription status and details.';



CREATE POLICY "Enable read access for profile owners" ON "public"."user_birth_details" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "user_birth_details"."profile_id") AND ("user_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own birth details" ON "public"."user_birth_details" USING (("auth"."uid"() = "profile_id"));



ALTER TABLE "public"."ai_generated_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collected_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_planet_transits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_astro_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_birth_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vectored_astro_data" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."prices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."subscription_plans";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";















































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."get_recent_chats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_chats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_chats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_setup"() TO "service_role";






GRANT ALL ON FUNCTION "public"."update_user_subscription"("p_user_id" "uuid", "p_price_id" bigint, "p_gateway_subscription_id" "text", "p_management_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_subscription"("p_user_id" "uuid", "p_price_id" bigint, "p_gateway_subscription_id" "text", "p_management_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_subscription"("p_user_id" "uuid", "p_price_id" bigint, "p_gateway_subscription_id" "text", "p_management_url" "text") TO "service_role";






























GRANT ALL ON TABLE "public"."ai_generated_questions" TO "anon";
GRANT ALL ON TABLE "public"."ai_generated_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_generated_questions" TO "service_role";



GRANT ALL ON TABLE "public"."call_feedback" TO "anon";
GRANT ALL ON TABLE "public"."call_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."call_feedback" TO "service_role";



GRANT ALL ON SEQUENCE "public"."call_feedback_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."call_feedback_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."call_feedback_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chat_history" TO "anon";
GRANT ALL ON TABLE "public"."chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_history" TO "service_role";



GRANT ALL ON TABLE "public"."collected_emails" TO "anon";
GRANT ALL ON TABLE "public"."collected_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."collected_emails" TO "service_role";



GRANT ALL ON TABLE "public"."global_planet_transits" TO "anon";
GRANT ALL ON TABLE "public"."global_planet_transits" TO "authenticated";
GRANT ALL ON TABLE "public"."global_planet_transits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."global_planet_transits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."global_planet_transits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."global_planet_transits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."prices" TO "anon";
GRANT ALL ON TABLE "public"."prices" TO "authenticated";
GRANT ALL ON TABLE "public"."prices" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prices_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile_astro_data" TO "anon";
GRANT ALL ON TABLE "public"."profile_astro_data" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_astro_data" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."system_prompts" TO "anon";
GRANT ALL ON TABLE "public"."system_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."system_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."user_birth_details" TO "anon";
GRANT ALL ON TABLE "public"."user_birth_details" TO "authenticated";
GRANT ALL ON TABLE "public"."user_birth_details" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_birth_details_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_birth_details_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_birth_details_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."users_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."users_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."users_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vectored_astro_data" TO "anon";
GRANT ALL ON TABLE "public"."vectored_astro_data" TO "authenticated";
GRANT ALL ON TABLE "public"."vectored_astro_data" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
