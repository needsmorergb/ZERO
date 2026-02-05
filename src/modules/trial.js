/**
 * Trial System Stub
 * Placeholder for Elite trial functionality
 */

export const Trial = {
    isActive() {
        return false;
    },

    hasBeenUsed() {
        return false;
    },

    sessionsRemaining() {
        return 0;
    },

    sessionsTotal() {
        return 0;
    },

    async redeem(code) {
        return { success: false, error: 'Trial system not available' };
    }
};
