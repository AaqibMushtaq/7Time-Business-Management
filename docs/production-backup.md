# Production Backup & Recovery Procedures

## Overview
This document outlines the backup and recovery procedures for the 7TIME Business Management Supabase production database. Financial records (e.g., NAEEM payments, deliveries, opening balances) are critical and must be strictly protected.

## Backup Process

### Supabase Project
- **Host**: Supabase Production Environment
- **Method**: Logical backup using the Supabase CLI (`supabase db dump`) or the Supabase Dashboard Export feature.
- **Responsibility**: Lead Developer / System Administrator.

### Frequency and Storage
- **Frequency**: Weekly logical backups are recommended if on the Supabase Free tier. Pro/Team tiers automatically maintain daily point-in-time recovery (PITR).
- **Storage**: Backups must be securely stored in an encrypted off-site cloud storage vault.
- **Security Constraint**: NEVER commit database `.sql` dumps containing production data into the GitHub repository.

## Recovery Procedure

If a production incident occurs, follow these steps to recover the database:

1. **Identify the Safe Recovery Point**
   - Assess the damage to identify the last known-good state.
   - If using PITR (Supabase Pro+), identify the exact timestamp before the incident.

2. **Restore / Recover**
   - **For Pro+ Tiers**: Use the Supabase Dashboard -> Database -> Backups to trigger a PITR restore.
   - **For Free Tier**: Use `psql` to safely import the last secure `.sql` logical dump.

3. **Verify Schema & Migrations**
   - Verify all migrations in `supabase/migrations/` match the restored schema.

4. **Verify Application Logic (NAEEM & Accounting)**
   - Log into the production application securely.
   - Check the **Opening Balance**, **Current Billed**, **Total Received**, and **Outstanding**.
   - Do NOT run destructive operations (`DROP TABLE`, `TRUNCATE`) to manually test recovery on live production.
