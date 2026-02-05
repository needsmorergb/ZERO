/**
 * Live Trade Coaching Feedback Loop
 *
 * Tracks coaching alert outcomes to adapt confidence scores over time.
 * When coaching warnings are validated by losses, confidence increases.
 * When warnings are false alarms (trade wins), confidence decreases.
 *
 * This creates adaptive coaching that learns which warnings the
 * trader actually needs vs which ones they handle well.
 */

import { Store } from '../store.js';

export const CoachingFeedback = {
    /**
     * Record that a coaching alert was shown
     * Called immediately when banner appears
     *
     * @param {string} triggerId - The trigger that fired
     * @param {Object} context - Trade context { side, solAmount, strategy, mint }
     */
    recordShown(triggerId, context) {
        const state = Store.state;
        if (!state) return;

        // Initialize coachingHistory if needed
        if (!state.coachingHistory) {
            state.coachingHistory = {};
        }

        // Initialize trigger tracking if needed
        if (!state.coachingHistory[triggerId]) {
            state.coachingHistory[triggerId] = {
                confidence: 0.5,      // Start at 50% confidence
                shown: 0,             // Times shown
                heeded: 0,            // Times user paused
                ignored: 0,           // Times user dismissed
                correctWarnings: 0,   // Warning shown -> trade lost
                falseAlarms: 0,       // Warning shown -> trade won
                lastShownAt: 0,
                pendingContext: null
            };
        }

        const tracker = state.coachingHistory[triggerId];
        tracker.shown++;
        tracker.lastShownAt = Date.now();
        tracker.pendingContext = {
            ...context,
            shownAt: Date.now()
        };

        Store.save();
        console.log(`[Coaching] Recorded show for ${triggerId} (shown: ${tracker.shown})`);
    },

    /**
     * Record trade outcome to update confidence scores
     * Called from Analytics.updateStreaks() after a SELL trade completes
     *
     * @param {Object} trade - The completed sell trade
     */
    recordOutcome(trade) {
        const state = Store.state;
        if (!state?.coachingHistory) return;

        const wasLoss = (trade.realizedPnlSol || 0) < 0;

        // Check all triggers for pending contexts
        for (const [triggerId, tracker] of Object.entries(state.coachingHistory)) {
            if (!tracker.pendingContext) continue;

            // Only count if trade happened within 5 minutes of showing
            const timeSinceShown = Date.now() - tracker.pendingContext.shownAt;
            if (timeSinceShown > 5 * 60 * 1000) {
                tracker.pendingContext = null;
                continue;
            }

            // Only match if same mint (if available)
            if (tracker.pendingContext.mint && trade.mint && tracker.pendingContext.mint !== trade.mint) {
                continue;
            }

            if (wasLoss) {
                // Warning was correct - increase confidence
                tracker.correctWarnings++;
                tracker.confidence = Math.min(1.0, tracker.confidence + 0.05);
                console.log(`[Coaching] ${triggerId} warning validated (loss). Confidence: ${(tracker.confidence * 100).toFixed(0)}%`);
            } else {
                // Warning was false alarm - decrease confidence
                tracker.falseAlarms++;
                tracker.confidence = Math.max(0.1, tracker.confidence - 0.03);
                console.log(`[Coaching] ${triggerId} was false alarm (win). Confidence: ${(tracker.confidence * 100).toFixed(0)}%`);
            }

            // Clear pending context after processing
            tracker.pendingContext = null;
        }

        Store.save();
    },

    /**
     * Record user dismissed the coaching alert
     * Called when user clicks the X button
     *
     * @param {string} triggerId - The trigger that was dismissed
     */
    recordDismiss(triggerId) {
        const state = Store.state;
        if (!state?.coachingHistory?.[triggerId]) return;

        state.coachingHistory[triggerId].ignored++;
        console.log(`[Coaching] ${triggerId} dismissed (ignored: ${state.coachingHistory[triggerId].ignored})`);

        Store.save();
    },

    /**
     * Record user clicked "Pause 5 min"
     * This shows the user trusts the coaching system
     *
     * @param {string} triggerId - The trigger that was paused
     * @param {number} duration - Pause duration in milliseconds
     */
    recordPause(triggerId, duration) {
        const state = Store.state;
        if (!state?.coachingHistory?.[triggerId]) return;

        const tracker = state.coachingHistory[triggerId];
        tracker.heeded++;
        tracker.pausedUntil = Date.now() + duration;

        // User trusting the system increases confidence slightly
        tracker.confidence = Math.min(1.0, tracker.confidence + 0.02);

        console.log(`[Coaching] ${triggerId} paused for ${duration / 60000} min (heeded: ${tracker.heeded})`);

        Store.save();
    },

    /**
     * Get coaching stats for a specific trigger
     *
     * @param {string} triggerId
     * @returns {Object|null} - Tracker stats or null
     */
    getStats(triggerId) {
        const state = Store.state;
        return state?.coachingHistory?.[triggerId] || null;
    },

    /**
     * Get overall coaching effectiveness stats
     *
     * @returns {Object} - { totalShown, totalCorrect, totalFalse, accuracy }
     */
    getOverallStats() {
        const state = Store.state;
        if (!state?.coachingHistory) {
            return { totalShown: 0, totalCorrect: 0, totalFalse: 0, accuracy: null };
        }

        let totalShown = 0;
        let totalCorrect = 0;
        let totalFalse = 0;

        for (const tracker of Object.values(state.coachingHistory)) {
            totalShown += tracker.shown || 0;
            totalCorrect += tracker.correctWarnings || 0;
            totalFalse += tracker.falseAlarms || 0;
        }

        const total = totalCorrect + totalFalse;
        const accuracy = total > 0 ? ((totalCorrect / total) * 100).toFixed(1) : null;

        return { totalShown, totalCorrect, totalFalse, accuracy };
    },

    /**
     * Reset coaching history (for testing)
     */
    reset() {
        const state = Store.state;
        if (state) {
            state.coachingHistory = {};
            Store.save();
        }
    }
};
