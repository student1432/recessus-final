import { db } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = "VERIFYING...";
    
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const allocation = document.getElementById('allocation').value;
    const participation = document.getElementById('participation').value;
    const err = document.getElementById('error-msg');
    const eventStatus = document.getElementById('event-status');

    // Clear previous messages
    err.textContent = '';
    eventStatus.style.display = 'none';

    try {
        // Check event start time first
        const eventConfigDoc = await getDoc(doc(db, 'settings', 'eventConfig'));
        let eventHasStarted = true;
        let earlyLoginMessage = "Event has not started yet. Please check back later.";

        if (eventConfigDoc.exists()) {
            const config = eventConfigDoc.data();
            earlyLoginMessage = config.earlyLoginMessage || earlyLoginMessage;
            
            if (config.eventStartTime) {
                const eventStart = config.eventStartTime.toDate();
                const now = new Date();
                eventHasStarted = now >= eventStart;
            }
        }

        if (!eventHasStarted) {
            eventStatus.textContent = earlyLoginMessage;
            eventStatus.style.display = 'block';
            btn.textContent = originalText;
            return;
        }

        // Authenticate user
        const snap = await getDoc(doc(db, 'delegates', user));
        if (!snap.exists()) {
            err.textContent = "DELEGATE NOT FOUND.";
            btn.textContent = originalText;
            return;
        }

        const delegateData = snap.data();
        if (delegateData.passcode !== pass) {
            err.textContent = "INVALID ACCESS KEY.";
            btn.textContent = originalText;
            return;
        }

        // Validate allocation matches what's stored in database
        if (delegateData.allocation && delegateData.allocation !== allocation) {
            err.textContent = `INVALID ALLOCATION. Expected: ${delegateData.allocation}`;
            btn.textContent = originalText;
            return;
        }

        // Set voting rights based on participation status
        const isVoting = participation === 'voting';

        // Update delegate profile with allocation and participation
        await setDoc(doc(db, 'delegates', user), {
            participation: participation, // "voting" or "present"
            is_voting: isVoting, // Based on participation
            lastLogin: new Date()
        }, { merge: true });

        // Store session data
        localStorage.setItem('recessus_user', user);
        localStorage.setItem('recessus_allocation', allocation);
        localStorage.setItem('recessus_participation', participation);
        localStorage.setItem('recessus_is_voting', isVoting.toString());

        btn.textContent = "ACCESS GRANTED";
        
        // Redirect to enhanced delegate portal
        setTimeout(() => {
            window.location.href = 'delegate-enhanced.html';
        }, 1000);

    } catch (error) {
        console.error('Login error:', error);
        err.textContent = "SYSTEM ERROR. PLEASE TRY AGAIN.";
        btn.textContent = originalText;
    }
});

// Add input validation and styling
document.getElementById('username').addEventListener('input', function(e) {
    // Don't auto-convert to uppercase - keep case-sensitive
    // e.target.value = e.target.value.toUpperCase();
});

document.getElementById('allocation').addEventListener('change', function() {
    if (this.value) {
        this.style.color = 'var(--gold-solid)';
    } else {
        this.style.color = 'white';
    }
});

document.getElementById('participation').addEventListener('change', function() {
    if (this.value) {
        this.style.color = 'var(--gold-solid)';
    } else {
        this.style.color = 'white';
    }
});

// Check if user is already logged in
window.addEventListener('load', async () => {
    const existingUser = localStorage.getItem('recessus_user');
    if (existingUser) {
        // Verify user still exists in database
        try {
            const snap = await getDoc(doc(db, 'delegates', existingUser));
            if (snap.exists()) {
                // Redirect to delegate portal
                window.location.href = 'delegate-enhanced.html';
            } else {
                // Clear invalid session
                localStorage.clear();
            }
        } catch (error) {
            console.error('Session verification error:', error);
        }
    }
    
    // Check for quick login test credentials
    const quickUser = localStorage.getItem('quick_test_user');
    const quickPass = localStorage.getItem('quick_test_pass');
    const quickAllocation = localStorage.getItem('quick_test_allocation');
    const quickParticipation = localStorage.getItem('quick_test_participation');
    
    if (quickUser && quickPass) {
        // Auto-fill login form
        document.getElementById('username').value = quickUser;
        document.getElementById('password').value = quickPass;
        document.getElementById('allocation').value = quickAllocation;
        document.getElementById('participation').value = quickParticipation;
        
        // Clear quick login data
        localStorage.removeItem('quick_test_user');
        localStorage.removeItem('quick_test_pass');
        localStorage.removeItem('quick_test_allocation');
        localStorage.removeItem('quick_test_participation');
        
        // Show notification
        const err = document.getElementById('error-msg');
        err.textContent = "🚀 Quick login test credentials loaded! Click 'INITIALIZE UPLINK' to continue.";
        err.style.color = '#3498db';
    }
});
