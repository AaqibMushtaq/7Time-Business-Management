# 7TIME BUSINESS MANAGEMENT — NAEEM PRODUCTION PAYMENT OPERATIONAL CHECKLIST

**Document Type:** Production Live Verification Checklist for Authorized Business User  
**Target Environment:** 7TIME Production (`haofuuvwciqsambgeqyn` / AP-South-1)  
**Target Module:** NAEEM Contract Delivery Ledger (`/naeem`)  
**Underlying Architecture:** PostgreSQL Atomic RPC `public.record_naeem_payment_with_allocations`  
**Purpose:** Standardized operational procedure to record and verify one legitimate business payment in production without synthetic test data.

---

## Pre-Requisites & Operational Rules

> [!IMPORTANT]
> **READ CAREFULLY BEFORE PROCEEDING:**
> 1. **Legitimate Payment Only:** Do not enter dummy or test data. Use only an authentic payment received from NAEEM.
> 2. **Single Click Rule:** Click the "Record Payment" button **exactly once**. Never double-click or repeatedly tap the submit button.
> 3. **Stop on Error:** If any error toast or banner appears, **STOP IMMEDIATELY**. Do not retry or submit again. Follow Section 6.
> 4. **No Destructive Actions:** Do not delete or alter previous historical payments during this verification.

---

## SECTION 1: Pre-Submission Baseline Recording

Before opening the payment modal, inspect and record the current system baseline values on the `/naeem` page:

| # | Inspection Item | Location on Screen | Baseline Value to Record | Status |
| :-: | :--- | :--- | :--- | :---: |
| **1.1** | **Active Month & Year** | Top-right Month Selector | Current view: `____________________` | [ ] |
| **1.2** | **Total Outstanding** | KPI Card 2 (Blue Card) | Pre-payment: `₹__________________` | [ ] |
| **1.3** | **Total Payments This Month** | KPI Card 4 (Purple Card) | Pre-payment: `₹__________________` | [ ] |
| **1.4** | **Oldest Pending Delivery** | Main Deliveries Table | Delivery Date: `____________________`<br>Unpaid Balance: `₹__________________` | [ ] |
| **1.5** | **Recent Payments Count** | Bottom "Recent Payments" Table | Existing row count: `____` payments | [ ] |

---

## SECTION 2: Form Input & Allocation Inspection

1. Click the blue **"Record Payment"** button in the top action bar (or press `Alt+P`).
2. Complete the required payment fields:

| Field Name | User Input Instructions | Recorded Test Value |
| :--- | :--- | :--- |
| **Amount Received (₹)** | Enter the legitimate received amount (Must be $> 0$ and $\le$ Total Outstanding). | `₹____________________` |
| **Payment Date** | Select the exact date money was received (Defaults to today). | `____________________` |
| **Payment Method** | Select `Cash`, `UPI`, `Bank Transfer`, or `Cheque`. | `____________________` |
| **Reference / Cheque #** | Optional for Cash; enter transaction UTR or Cheque number if applicable. | `____________________` |
| **Bank Name** | Optional; enter bank name if Cheque or Transfer. | `____________________` |
| **Notes** | Enter descriptive note (e.g., `Nov delivery settlement - authorized validation`). | `____________________` |

3. **Inspect the Allocation Preview:**
   - Look at the summary box at the bottom of the modal labeled **"Current Outstanding / Payment / Remaining Outstanding"**.
   - Verify that the **Remaining Outstanding** accurately reflects:
     $$\text{Remaining} = \text{Current Outstanding} - \text{Amount Received}$$
   - Confirm that the automatic allocation engine matches the oldest pending deliveries in chronological (FIFO) order.

---

## SECTION 3: Single-Click Submission Protocol

Execute the submission following this strict protocol:

1. Visually verify that all fields in Section 2 are complete and correct.
2. Position the cursor over the blue **"Record Payment"** button in the modal footer.
3. Click the button **EXACTLY ONCE**:
   - The button will immediately disable.
   - The button text will change from `Record Payment` to `Recording...` with an animated spinner.
4. **WAIT** for the transaction to complete:
   - Do **NOT** refresh the page.
   - Do **NOT** click the Cancel button.
   - Do **NOT** close the browser tab.
5. Successful completion is confirmed when the modal closes automatically without an error alert.

---

## SECTION 4: Post-Submission Verification Checks

Once the modal closes, complete the following 4 verification checks:

### Check 4.1: Recent Payments Table Update
- Scroll down to the **"Recent Payments"** table at the bottom of the page.
- [ ] Confirm a new row appears with the exact date, payment method, and amount entered.
- [ ] Confirm the total payment count has increased by exactly 1.

### Check 4.2: Delivery Ledger Paid & Balance Updates
- Inspect the main **"NAEEM Contract Route Deliveries"** table:
- [ ] Locate the delivery record(s) that were targeted by the allocation.
- [ ] Confirm that the **"Paid"** column for that delivery increased by the allocated amount.
- [ ] Confirm that the **"Balance"** column decreased by the allocated amount.
- [ ] If fully settled, confirm that the status badge transitioned from `Pending` to `Paid`.

### Check 4.3: KPI Balance Recalculation
- Inspect the top KPI summary cards:
- [ ] **"Total Payments This Month"** has increased by exactly the payment amount:
  $$\text{New Payments} = \text{Previous Payments} + \text{Payment Amount}$$
- [ ] **"Total Outstanding"** has decreased by exactly the payment amount:
  $$\text{New Outstanding} = \text{Previous Outstanding} - \text{Payment Amount}$$

### Check 4.4: Allocation Record Parity
- Click to expand or inspect the payment record details (or view recent allocations):
- [ ] Confirm that the sum of all allocation amounts equals the total payment amount ($0.00$ unallocated discrepancy).

---

## SECTION 5: Persistence & Anti-Duplication Check

To ensure that the payment was committed atomically to persistent storage and not merely held in temporary client state:

1. Perform a hard browser reload:
   - On Windows: Press `Ctrl + F5` (or `Ctrl + Shift + R`).
2. Once the page reloads, re-inspect:
   - [ ] The payment remains visible in the **Recent Payments** table.
   - [ ] The delivery row balances remain updated.
   - [ ] The KPI totals remain updated.
   - [ ] **Zero duplicate payments:** Exactly 1 payment row exists for this transaction.

---

## SECTION 6: Error Handling & Abort Protocol

> [!CAUTION]
> If an error dialog, red toast, or network failure occurs at any point during submission:

1. **DO NOT RESUBMIT.** Do not click the submit button again.
2. Note the exact error message text displayed on screen:
   - *Recorded Error Text:* `________________________________________________`
   - *Timestamp:* `________________________________________________`
3. Check the database state safely:
   - Refresh the page once (`F5`).
   - If the payment is **NOT** present in the Recent Payments table, the database transaction rolled back cleanly as designed.
   - If the payment is present, it was committed before the network response timed out.
4. Report the error text to the technical team immediately for inspection in Supabase logs.

---

## SECTION 7: Operational Verification Sign-Off

| Role | Name | Signature / Confirmation | Date & Time |
| :--- | :--- | :--- | :--- |
| **Operator (Business User)** | `____________________` | `[ ] VERIFIED IN LIVE UI` | `____-__-__ __:__` |
| **Reviewer (Technical Lead)**| `____________________` | `[ ] LEDGER PARITY CONFIRMED` | `____-__-__ __:__` |

