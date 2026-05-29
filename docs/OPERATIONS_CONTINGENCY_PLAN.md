# Speako — Operations & Contingency Plan

> Last updated: 2026-05-29  
> Purpose: Know your costs, know your break-even, know when to pull the plug.

---

## 1. Cost Baseline (What You Actually Pay)

### Fixed Costs (Even at 0 Users)

| Item | Monthly | Annual | Notes |
|------|---------|--------|-------|
| Firebase Spark (free tier) | $0 | $0 | Auth, Firestore, Hosting, Analytics |
| Expo / EAS Build | $0 | $0 | Free tier covers basic builds |
| Google Play Developer | — | $25 one-time | |
| Apple Developer | — | $99/year | Required for iOS builds |
| **Fixed total** | **~$8** | **~$99** | Just Apple dev + rounding |

### Variable Costs (Scale With Usage)

| Item | Free Limit | Cost After Limit | At 1K DAU | At 5K DAU |
|------|-----------|------------------|-----------|-----------|
| Firestore reads | 50K/day | $0.06 / 100K | $0 | $9 |
| Firestore writes | 20K/day | $0.18 / 100K | $3 | $45 |
| Firestore storage | 1 GB | $0.18 / GB | $0 | $2 |
| Firebase Storage | 5 GB | $0.026 / GB | $0 | $1 |
| **Firebase subtotal** | — | — | **$3/mo** | **$57/mo** |

### Translation API Costs

| Provider | Status | Cost | Disaster Risk |
|----------|--------|------|---------------|
| Google Translate (`client=gtx`) | **PRIMARY** | Free | HIGH — unofficial endpoint, can break anytime |
| DeepL | Not configured | 500K chars/mo free, then ~$0.00002/char | LOW — stable but needs key |
| MyMemory | Fallback | Free | MED — rate limits, 480char cap |
| LibreTranslate | Last resort | Free | HIGH — public instance, slow |
| OpenAI | Not Implemented | Would be $5–30/mo at 1K DAU | |

**Current translation cost: $0/month** (riding free APIs).
**If Google endpoint breaks and you switch to DeepL paid:** ~$10–50/month depending on volume.

---

## 2. Revenue — Conservative Estimate (30% Short)

We calculate revenue at **70% of realistic projections** to build a safety buffer.

### Assumptions (Conservative)

| Metric | Optimistic | Conservative (70%) |
|--------|-----------|-------------------|
| eCPM (global mixed) | $0.80 | **$0.56** |
| Ad impressions / DAU | 11 | **8** |
| Rewarded ad completion | 10% | **7%** |

### Revenue at Conservative Estimate

| DAU | Impressions/Day | Revenue/Day | Revenue/Month | Notes |
|-----|-----------------|-------------|---------------|-------|
| 100 | 800 | $0.45 | **~$13** | Not worth the Firebase reads |
| 500 | 4,000 | $2.24 | **~$67** | Break-even territory |
| 1,000 | 8,000 | $4.48 | **~$134** | First meaningful revenue |
| 5,000 | 40,000 | $22.40 | **~$672** | Covers your time |
| 10,000 | 80,000 | $44.80 | **~$1,344** | Worth scaling |

**Key insight:** You need **~500 DAU** to cover Apple dev fees + Firebase overages. Below that, you're losing money.

---

## 3. Break-Even Matrix

```
                    COSTS
                Low     High
              ┌────────┬────────┐
         High │ PROFIT │ PROFIT │
REVENUE       │  Safe  │  Tight │
              ├────────┼────────┤
          Low │  KILL  │  KILL  │
              │  Now   │  Now   │
              └────────┴────────┘
```

### Specific Scenarios

| Scenario | Monthly Cost | Monthly Revenue | Action |
|----------|-------------|-----------------|--------|
| **A. < 300 DAU, everything free** | $8 | $0–20 | **KILL** — not enough users to justify maintenance |
| **B. 500 DAU, Google API breaks, using DeepL** | $45 | $67 | **BORDERLINE** — monitor for 2 weeks, if no growth, kill |
| **C. 1K DAU, free APIs working** | $15 | $134 | **KEEP** — 9x cost coverage, optimize ad placements |
| **D. 1K DAU, Google API broken, DeepL paid** | $55 | $134 | **KEEP** — still 2.4x coverage, fix API later |
| **E. 5K DAU, Firestore costs spike** | $120 | $672 | **KEEP** — 5.6x coverage, investigate read optimization |
| **F. 5K DAU, eCPM crashes to $0.20** | $57 | $240 | **KEEP** — 4.2x coverage, but investigate ad network |

**Your personal time is NOT in this math.** If you spend 5 hours/week on this app, that's 20 hours/month. At any reasonable hourly rate, the app is losing money until you hit **~5K DAU**.

---

## 4. Disaster Scenarios & Playbooks

### Disaster 1: Google Translate Endpoint Breaks

**Symptoms:** Users report translations not working, app shows original text only.
**Detection:** Monitor `translation_completed` events with `provider: 'fallback'` or `provider: 'none'`.

**Immediate (0–2 hours):**
1. Set `DEEPL_API_KEY` in environment and redeploy
2. If no DeepL key ready, promote MyMemory to primary in `translation.ts`
3. Post incident notice in-app if outage > 30 min

**Short-term (1–3 days):**
4. Apply for DeepL free API key (instant approval)
5. If volume exceeds 500K chars/month, set up DeepL paid tier

**Cost impact:** $0 → $10–50/month
**Kill threshold:** If DeepL costs exceed 50% of ad revenue for 2 weeks straight.

---

### Disaster 2: Firebase Bill Spikes Unexpectedly

**Symptoms:** Firebase billing email shows charges > $50 when you expected $5.
**Common causes:**
- Inefficient listeners (subscribing to entire collections)
- Missing `limit()` on queries
- Bot traffic / DDoS on public endpoints
- Runaway Cloud Function (if you add any later)

**Immediate:**
1. Go to Firebase Console → Usage → identify the service spiking
2. Set billing alerts at $10, $25, $50
3. If Firestore reads are the cause, add daily quotas in app code:
   ```typescript
   // Cap conversation list to last 50
   query(collection(db, 'conversations'), limit(50))
   ```

**Circuit breaker:**
4. If Firebase bill exceeds ad revenue for 2 consecutive weeks, **pause new user signups** and evaluate kill.

---

### Disaster 3: Ad eCPM Crashes

**Symptoms:** AdMob dashboard shows eCPM dropped from $0.80 to $0.20 or lower.
**Causes:** Seasonal (Q1 is always low), Google policy change, app category blacklisting, mostly users from low-CPM countries.

**Checks:**
1. Verify eCPM by country — if India/Pakistan/Bangladesh are 80% of users, eCPM will naturally be $0.10–0.30
2. Check AdMob policy center for any violations
3. Check if ad fill rate dropped (supply issue, not demand)

**Actions:**
- If eCPM < $0.30 for 4+ weeks: Add a second ad network (AppLovin, ironSource) as mediation fallback
- If fill rate < 80%: Switch to another network entirely
- If both are bad and users are low-CPM countries: **This is a structural problem.** The app will not make money. Kill or pivot to B2B.

---

### Disaster 4: App Store Rejection or Ban

**iOS rejection:** Common reasons are "minimal functionality" or "not enough native features."
**Google Play ban:** Usually from ad policy (accidental clicks, misleading button placement near ads).

**Prevention:**
- Keep ad buttons at least 20px from interactive elements
- Don't use deceptive "close" buttons on interstitials
- Keep the app functional without internet (cache last conversation)

**If rejected:**
1. Fix the specific issue within 48 hours
2. If rejected 3 times for the same reason, the app concept may be the problem
3. **Kill threshold:** If both stores reject and you have no distribution channel, the prototype is dead.

---

### Disaster 5: User Data / Privacy Incident

**Speako stores:** Email, display name, language preference, conversation text, message content.
**Risk level:** LOW (no payment info, no government IDs, no location tracking).

**If breached:**
1. You are legally required to notify affected users within 72 hours (GDPR) if any EU users exist
2. Reset all auth sessions: Firebase Console → Authentication → Reset all sessions
3. Check Firestore security rules for leaks
4. If the breach was via compromised service account key: rotate keys immediately

**Prevention:**
- Review `firestore.rules` — ensure users can only read their own conversations
- Never log message content to console in production builds

---

### Disaster 6: No One Uses It (The Slow Death)

**Symptoms:**
- DAU flat for 4+ weeks
- No organic referrals
- Average messages per conversation < 3
- Rewarded ad watch rate < 5%

**This is the most likely disaster.** Not a technical failure — a market failure.

**Decision matrix:**

| Weeks Since Launch | DAU | Avg Messages/Convo | Decision |
|-------------------|-----|-------------------|----------|
| Week 2 | < 50 | < 2 | Normal for early stage, keep promoting |
| Week 4 | < 100 | < 3 | Try Reddit/language learning communities |
| Week 8 | < 200 | < 3 | **Yellow flag** — fix cold start, add AI partner |
| Week 12 | < 300 | < 3 | **RED FLAG** — spend 2 weeks on distribution, then decide |
| Week 16 | < 300 | < 3 | **KILL** — no product-market fit |

**Kill criteria (meet ANY one):**
1. 16 weeks post-launch, DAU < 300, and no growth trend
2. Average messages per conversation < 3 for 30 days
3. Rewarded ad watch rate < 3% for 30 days (means points economy is broken)
4. You personally spend > 10 hours/month and revenue < $50/month

---

## 5. Weekly Health Check (5 Minutes)

Every Monday, check these 4 numbers:

1. **Firebase Console → Analytics → Active users (7 days)**
2. **AdMob → Estimated earnings (7 days)**
3. **Firebase Console → Firestore → Usage (reads + writes)**
4. **Manually calculate:** Messages per active user = total messages / DAU

**Green light:** DAU growing, messages/user > 5, revenue > costs.
**Yellow light:** DAU flat, messages/user 2–5, revenue ~ costs.
**Red light:** DAU declining, messages/user < 2, revenue < costs for 2+ weeks.

---

## 6. Kill Switch Checklist

If you decide to shut it down, do this in order:

- [ ] Export all user emails (for "we're shutting down" notice)
- [ ] Post shutdown notice in app 14 days before
- [ ] Disable new signups in Firebase Auth (set custom claims or UI block)
- [ ] After shutdown date: delete Firestore data or export and archive
- [ ] Cancel Apple Developer account (saves $99/year)
- [ ] Remove app from stores
- [ ] Keep Firebase project for 30 days in case users need data export
- [ ] Write a post-mortem: what worked, what didn't, what to reuse

---

## 7. Summary: Your Disaster Budget

| What | Amount |
|------|--------|
| Maximum you're willing to lose per month | **$50** |
| Maximum you're willing to lose total before calling it | **$300** |
| Revenue needed to justify your time (20 hrs/mo @ $20/hr) | **$400/month** |
| DAU needed for $400/month (conservative) | **~3,000 DAU** |
| DAU needed to just break even on costs | **~500 DAU** |

**The gap between "surviving" (500 DAU) and "worth your time" (3,000 DAU) is 6x.** Most apps never cross that gap. Be honest with yourself about which side you're on after 12 weeks.
