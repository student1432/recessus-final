import { db } from './firebase.js';
import { doc, setDoc, getDoc, onSnapshot, collection, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// SIMPLE ACCESS CONTROL
const PASS = prompt("ENTER LEVEL 5 CLEARANCE KEY:");
if (PASS === "2026") {
    document.getElementById('admin-panel').style.display = "block";
} else {
    alert("ACCESS DENIED.");
    window.location.href = "index-enhanced.html";
}

const status = document.getElementById('status-msg');
const votingStatus = document.getElementById('voting-status');
const currentStatus = document.getElementById('current-status');
const delegatesTable = document.getElementById('delegates-table');

// Voting Control Functions
let currentVotingSession = null;

document.getElementById('start-vote-btn').onclick = async () => {
    const title = document.getElementById('resolution-title').value.trim();
    const timeLimit = parseInt(document.getElementById('voting-time-limit').value);

    if (!title) {
        status.textContent = "PLEASE ENTER RESOLUTION TITLE.";
        return;
    }

    try {
        const voteId = `vote_${Date.now()}`;
        const endTime = new Date(Date.now() + (timeLimit * 60 * 1000));

        await setDoc(doc(db, 'voting', 'activeVote'), {
            id: voteId,
            title: title,
            startTime: new Date(),
            endTime: endTime,
            status: 'active',
            results: { in_favour: 0, against: 0, passed: false }
        });

        status.textContent = "VOTING SESSION INITIATED.";
        votingStatus.style.display = 'block';
        currentStatus.textContent = 'ACTIVE - ' + title;

        // Show veto section and results preview
        document.getElementById('veto-section').style.display = 'block';
        document.getElementById('results-preview').style.display = 'block';

        // Reset all delegate votes for new session
        const delegatesSnapshot = await getDocs(collection(db, 'delegates'));
        delegatesSnapshot.forEach(async (delegateDoc) => {
            await setDoc(doc(db, 'delegates', delegateDoc.id), {
                currentVote: null
            }, { merge: true });
        });

        // Set up auto-publish timer
        setTimeout(async () => {
            const voteDoc = await getDoc(doc(db, 'voting', 'activeVote'));
            if (voteDoc.exists() && voteDoc.data().status === 'active') {
                await endVoting();
                await publishResults();
                status.textContent = "VOTING TIME EXPIRED - AUTO-PUBLISHED.";
            }
        }, timeLimit * 60 * 1000);

    } catch (error) {
        status.textContent = "FAILED TO START VOTING.";
        console.error(error);
    }
};

// Veto Power Functions
document.getElementById('veto-pass-btn').onclick = async () => {
    try {
        await setDoc(doc(db, 'voting', 'activeVote'), {
            status: 'published',
            results: { in_favour: 999, against: 0, passed: true, vetoed: true }
        }, { merge: true });

        status.textContent = "RESULT VETOED - FORCED PASS.";
        currentStatus.textContent = 'PUBLISHED - PASSED (VETO)';
    } catch (error) {
        status.textContent = "FAILED TO VETO.";
        console.error(error);
    }
};

document.getElementById('veto-fail-btn').onclick = async () => {
    try {
        await setDoc(doc(db, 'voting', 'activeVote'), {
            status: 'published',
            results: { in_favour: 0, against: 999, passed: false, vetoed: true }
        }, { merge: true });

        status.textContent = "RESULT VETOED - FORCED FAIL.";
        currentStatus.textContent = 'PUBLISHED - FAILED (VETO)';
    } catch (error) {
        status.textContent = "FAILED TO VETO.";
        console.error(error);
    }
};

document.getElementById('end-vote-btn').onclick = async () => {
    try {
        await setDoc(doc(db, 'voting', 'activeVote'), {
            status: 'ended'
        }, { merge: true });

        status.textContent = "VOTING SESSION ENDED.";
        currentStatus.textContent = 'ENDED';

    } catch (error) {
        status.textContent = "FAILED TO END VOTING.";
        console.error(error);
    }
};

document.getElementById('publish-results-btn').onclick = async () => {
    try {
        const voteDoc = await getDoc(doc(db, 'voting', 'activeVote'));
        if (voteDoc.exists()) {
            const data = voteDoc.data();
            const passed = data.results.in_favour > data.results.against;

            await setDoc(doc(db, 'voting', 'activeVote'), {
                status: 'published',
                results: { ...data.results, passed: passed }
            }, { merge: true });

            status.textContent = "RESULTS PUBLISHED.";
            currentStatus.textContent = 'PUBLISHED - ' + (passed ? 'PASSED' : 'FAILED');
        }
    } catch (error) {
        status.textContent = "FAILED TO PUBLISH RESULTS.";
        console.error(error);
    }
};

// Real-time Voting Status Updates
onSnapshot(doc(db, 'voting', 'activeVote'), (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        currentVotingSession = data;

        if (data.status === 'active') {
            votingStatus.style.display = 'block';
            currentStatus.textContent = 'ACTIVE - ' + data.title;
        } else if (data.status === 'ended') {
            currentStatus.textContent = 'ENDED';
        } else if (data.status === 'published') {
            currentStatus.textContent = 'PUBLISHED - ' + (data.results.passed ? 'PASSED' : 'FAILED');
        }
    } else {
        votingStatus.style.display = 'none';
        currentVotingSession = null;
    }
});

// Delegate Management
document.getElementById('refresh-delegates-btn').onclick = async () => {
    try {
        const delegatesSnapshot = await getDocs(collection(db, 'delegates'));
        let tableHTML = `
            <table style="width: 100%; border-collapse: collapse; font-family: 'Share Tech Mono', monospace; font-size: 0.85rem; color: white;">
                <thead style="position: sticky; top: 0; z-index: 10;">
                    <tr style="border-bottom: 2px solid var(--gold-solid); background: rgba(0,0,0,0.4);">
                        <th style="padding: 1rem 0.5rem; text-align: left; color: var(--gold-solid); position: sticky; top: 0; background: rgba(0,0,0,0.4);">DELEGATE</th>
                        <th style="padding: 1rem 0.5rem; text-align: left; color: var(--gold-solid); position: sticky; top: 0; background: rgba(0,0,0,0.4);">ALLOCATION</th>
                        <th style="padding: 1rem 0.5rem; text-align: left; color: var(--gold-solid); position: sticky; top: 0; background: rgba(0,0,0,0.4);">PARTICIPATION</th>
                        <th style="padding: 1rem 0.5rem; text-align: left; color: var(--gold-solid); position: sticky; top: 0; background: rgba(0,0,0,0.4);">VOTING</th>
                        <th style="padding: 1rem 0.5rem; text-align: left; color: var(--gold-solid); position: sticky; top: 0; background: rgba(0,0,0,0.4);">VIDEO</th>
                        <th style="padding: 1rem 0.5rem; text-align: left; color: var(--gold-solid); position: sticky; top: 0; background: rgba(0,0,0,0.4);">CURRENT VOTE</th>
                        <th style="padding: 1rem 0.5rem; text-align: left; color: var(--gold-solid); position: sticky; top: 0; background: rgba(0,0,0,0.4);">PASSCODE</th>
                        <th style="padding: 1rem 0.5rem; text-align: left; color: var(--gold-solid); position: sticky; top: 0; background: rgba(0,0,0,0.4);">ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
        `;

        delegatesSnapshot.forEach((delegateDoc) => {
            const data = delegateDoc.data();
            const delegateId = delegateDoc.id;
            tableHTML += `
                <tr style="border-bottom: 1px solid rgba(212,175,55,0.1); transition: background 0.3s ease;">
                    <td style="padding: 0.8rem 0.5rem; font-weight: bold;">${delegateId.toUpperCase()}</td>
                    <td style="padding: 0.8rem 0.5rem;">${data.allocation || 'N/A'}</td>
                    <td style="padding: 0.8rem 0.5rem; color: var(--accent);">${data.participation ? data.participation.replace('_', ' ').toUpperCase() : 'N/A'}</td>
                    <td style="padding: 0.8rem 0.5rem;">${data.is_voting ? '<span style="color: #2ecc71;">YES</span>' : '<span style="color: #e74c3c;">NO</span>'}</td>
                    <td style="padding: 0.8rem 0.5rem; text-align: center;">${data.hasWatchedVideo ? '<span style="color: #2ecc71;">✓</span>' : '<span style="color: #e74c3c;">✗</span>'}</td>
                    <td style="padding: 0.8rem 0.5rem; font-family: 'Cinzel', serif; letter-spacing: 1px;">${data.currentVote || '---'}</td>
                    <td style="padding: 0.8rem 0.5rem; font-family: 'Share Tech Mono', monospace; color: #3498db;">${data.passcode || 'N/A'}</td>
                    <td style="padding: 0.8rem 0.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="window.overrideVote('${delegateId}', 'in_favour')" class="gold-action-btn" style="padding: 0.3rem 0.6rem; font-size: 0.7rem; background: #2ecc71; border-color: #2ecc71;">FAVOUR</button>
                            <button onclick="window.overrideVote('${delegateId}', 'against')" class="gold-action-btn" style="padding: 0.3rem 0.6rem; font-size: 0.7rem; background: #e74c3c; border-color: #e74c3c;">AGAINST</button>
                            <button onclick="window.overrideVote('${delegateId}', null)" class="gold-border-btn" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;">RESET</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        delegatesTable.innerHTML = tableHTML;
        status.textContent = "DELEGATE DATA REFRESHED.";

    } catch (error) {
        status.textContent = "FAILED TO REFRESH DELEGATES.";
        console.error(error);
    }
};

document.getElementById('export-delegates-btn').onclick = () => {
    // Simple CSV export functionality
    const table = delegatesTable.querySelector('table');
    if (!table) {
        status.textContent = "NO DELEGATE DATA TO EXPORT.";
        return;
    }

    let csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = Array.from(cols).map(col => col.textContent.trim()).join(',');
        csv.push(rowData);
    });

    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delegates_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    status.textContent = "DELEGATE DATA EXPORTED.";
};

// Event Settings
document.getElementById('save-settings-btn').onclick = async () => {
    const eventStartTime = document.getElementById('event-start-time').value;
    const earlyLoginMsg = document.getElementById('early-login-msg').value.trim();

    try {
        await setDoc(doc(db, 'settings', 'eventConfig'), {
            eventStartTime: eventStartTime ? new Date(eventStartTime) : null,
            earlyLoginMessage: earlyLoginMsg || "Event has not started yet. Please check back later.",
            lastUpdated: new Date()
        });

        status.textContent = "EVENT SETTINGS SAVED.";

    } catch (error) {
        status.textContent = "FAILED TO SAVE SETTINGS.";
        console.error(error);
    }
};

// Load existing settings on page load
window.addEventListener('load', async () => {
    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'eventConfig'));
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            if (data.eventStartTime) {
                document.getElementById('event-start-time').value = new Date(data.eventStartTime.toDate()).toISOString().slice(0, 16);
            }
            if (data.earlyLoginMessage) {
                document.getElementById('early-login-msg').value = data.earlyLoginMessage;
            }
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
});

// Real-time results preview
onSnapshot(doc(db, 'voting', 'activeVote'), (snapshot) => {
    const data = snapshot.data();
    if (data && data.status === 'active') {
        document.getElementById('preview-in-favour').textContent = data.results.in_favour || 0;
        document.getElementById('preview-against').textContent = data.results.against || 0;

        const total = (data.results.in_favour || 0) + (data.results.against || 0);
        if (total > 0) {
            const percentage = ((data.results.in_favour || 0) / total * 100).toFixed(1);
            document.getElementById('preview-status').textContent = `${total} votes cast (${percentage}% in favour)`;
        } else {
            document.getElementById('preview-status').textContent = 'AWAITING VOTES...';
        }
    }
});

// Admin Vote Override Function
window.overrideVote = async (delegateId, newVote) => {
    if (!currentVotingSession || currentVotingSession.status !== 'active') {
        alert("OVERRIDE ONLY POSSIBLE DURING ACTIVE VOTING SESSIONS.");
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const delegateRef = doc(db, 'delegates', delegateId);
            const voteRef = doc(db, 'voting', 'activeVote');

            const delegateDoc = await transaction.get(delegateRef);
            const voteDoc = await transaction.get(voteRef);

            if (!delegateDoc.exists() || !voteDoc.exists()) {
                throw "MISSING DATA FOR OVERRIDE.";
            }

            const delegateData = delegateDoc.data();
            const votingData = voteDoc.data();
            const oldVote = delegateData.currentVote;

            // Only proceed if the vote is actually different
            if (oldVote === newVote) return;

            const newResults = { ...votingData.results };

            // Subtract old vote
            if (oldVote === 'in_favour') {
                newResults.in_favour = Math.max(0, (newResults.in_favour || 0) - 1);
            } else if (oldVote === 'against') {
                newResults.against = Math.max(0, (newResults.against || 0) - 1);
            }

            // Add new vote
            if (newVote === 'in_favour') {
                newResults.in_favour = (newResults.in_favour || 0) + 1;
            } else if (newVote === 'against') {
                newResults.against = (newResults.against || 0) + 1;
            }

            // Update Delegate
            transaction.update(delegateRef, { currentVote: newVote });

            // Update Global Vote
            transaction.update(voteRef, { results: newResults });
        });

        status.textContent = `VOTE OVERRIDDEN FOR ${delegateId.toUpperCase()}.`;
        // Refresh the table to show updated status
        document.getElementById('refresh-delegates-btn').click();

    } catch (error) {
        console.error("Override failed:", error);
        status.textContent = "OVERRIDE FAILED: " + error;
    }
};
