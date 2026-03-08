import { db } from './firebase.js';
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const user = localStorage.getItem('recessus_user');
const participation = localStorage.getItem('recessus_participation');
const isVoting = participation === 'voting';

if (!user) window.location.href = 'index-enhanced.html';

// Profile Management
async function loadProfileData() {
    try {
        const delegateDoc = await getDoc(doc(db, 'delegates', user));
        if (delegateDoc.exists()) {
            const data = delegateDoc.data();

            // Update profile display
            document.getElementById('profile-username').textContent = user.toUpperCase();
            document.getElementById('profile-allocation').textContent = data.allocation || 'N/A';
            document.getElementById('profile-participation').textContent = data.participation ? data.participation.replace('_', ' ').toUpperCase() : 'N/A';
            document.getElementById('profile-voting-status').textContent = data.is_voting ? 'ENABLED' : 'DISABLED';
            document.getElementById('profile-video-status').textContent = data.hasWatchedVideo ? 'WATCHED' : 'NOT WATCHED';

            // Set voting rights toggle
            document.getElementById('voting-rights-toggle').value = data.is_voting ? 'true' : 'false';
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
    }
}

// Change Password
const changePasswordBtn = document.getElementById('change-password-btn');
if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', async () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const statusMessage = document.getElementById('profile-status-message');

        if (!currentPassword || !newPassword) {
            showProfileStatus('Please fill in both password fields', 'error');
            return;
        }

        if (newPassword.length < 4) {
            showProfileStatus('New password must be at least 4 characters', 'error');
            return;
        }

        try {
            // Verify current password
            const delegateDoc = await getDoc(doc(db, 'delegates', user));
            if (!delegateDoc.exists() || delegateDoc.data().passcode !== currentPassword) {
                showProfileStatus('Current password is incorrect', 'error');
                return;
            }

            // Update password
            await setDoc(doc(db, 'delegates', user), {
                passcode: newPassword,
                passwordChangedAt: new Date()
            }, { merge: true });

            showProfileStatus('Password updated successfully!', 'success');

            // Clear password fields
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';

        } catch (error) {
            console.error('Error changing password:', error);
            showProfileStatus('Failed to update password', 'error');
        }
    });
}

// Update Voting Rights
const updateVotingRightsBtn = document.getElementById('update-voting-rights-btn');
if (updateVotingRightsBtn) {
    updateVotingRightsBtn.addEventListener('click', async () => {
        const newVotingRights = document.getElementById('voting-rights-toggle').value === 'true';
        const statusMessage = document.getElementById('profile-status-message');

        try {
            await setDoc(doc(db, 'delegates', user), {
                participation: newVotingRights ? 'voting' : 'present',
                is_voting: newVotingRights,
                votingRightsChangedAt: new Date()
            }, { merge: true });

            // Update local storage
            localStorage.setItem('recessus_is_voting', newVotingRights.toString());
            localStorage.setItem('recessus_participation', newVotingRights ? 'voting' : 'present');

            // Update display
            document.getElementById('profile-voting-status').textContent = newVotingRights ? 'ENABLED' : 'DISABLED';
            document.getElementById('profile-participation').textContent = newVotingRights ? 'PRESENT AND VOTING' : 'PRESENT (OBSERVER)';

            showProfileStatus(`Voting rights ${newVotingRights ? 'enabled' : 'disabled'} successfully!`, 'success');

            // Refresh voting interface if needed
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('Error updating voting rights:', error);
            showProfileStatus('Failed to update voting rights', 'error');
        }
    });
}

// Show profile status message
function showProfileStatus(message, type) {
    const statusDiv = document.getElementById('profile-status-message');
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.style.color = type === 'success' ? 'var(--success-green)' : 'var(--danger-red)';
    statusDiv.style.borderColor = type === 'success' ? 'var(--success-green)' : 'var(--danger-red)';

    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// Voting Chart Setup
let votingChart = null;

function initializeVotingChart() {
    const ctx = document.getElementById('voting-chart');
    if (!ctx) return;

    votingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['In Favour', 'Against'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderColor: ['#27ae60', '#c0392b'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff',
                        font: {
                            family: 'Share Tech Mono'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff',
                        font: {
                            family: 'Share Tech Mono'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// Video Tracking (Disabled - Video element removed from HTML)
// Note: Crisis briefing video functionality disabled for now

// Voting System
function setupVotingInterface() {
    const votingSection = document.getElementById('voting-section');
    const votingInterface = document.getElementById('voting-interface');
    const resultsViewer = document.getElementById('results-viewer');
    const noVotingMessage = document.getElementById('no-voting-message');

    // Show voting section for all delegates
    votingSection.style.display = 'block';

    // Listen for voting session changes
    onSnapshot(doc(db, 'voting', 'activeVote'), (snapshot) => {
        const votingData = snapshot.data();
        if (!votingData) return;

        console.log('Voting data received:', votingData);
        console.log('User participation:', participation);
        console.log('Is voting:', isVoting);

        const votingStatus = document.getElementById('voting-status');
        const votingChart = document.getElementById('voting-chart');

        if (votingData.status === 'active') {
            // Active voting session
            console.log('Voting session active, checking voting rights...');
            if (isVoting) {
                console.log('User can vote, setting up voting interface');
                // Show voting interface for voting delegates
                setupVotingForDelegate(votingData);
            } else {
                console.log('User cannot vote, showing results viewer');
                // Show results viewer for non-voting delegates
                setupResultsViewer(votingData);
            }
        } else if (votingData.status === 'published') {
            // Show results for everyone and reset delegate votes
            console.log('Voting session published, showing results and resetting delegate');
            setupResultsViewer(votingData);
            resetDelegateVote();
        } else if (votingData.status === 'ended') {
            // Hide voting interface and results, show no-voting-message
            console.log('Voting session ended, hiding interface and resetting delegate');
            if (votingInterface) votingInterface.style.display = 'none';
            if (resultsViewer) resultsViewer.style.display = 'none';
            if (noVotingMessage) noVotingMessage.style.display = 'block';
            resetDelegateVote();
        }
    });
}

// Reset delegate vote when voting ends
async function resetDelegateVote() {
    try {
        const delegateDoc = await getDoc(doc(db, 'delegates', user));
        if (delegateDoc.exists() && delegateDoc.data().currentVote) {
            await setDoc(doc(db, 'delegates', user), {
                currentVote: null
            }, { merge: true });
            console.log('Delegate vote reset');
        }
    } catch (error) {
        console.error('Error resetting delegate vote:', error);
    }
}

async function setupVotingForDelegate(votingData) {
    console.log('Setting up voting interface for delegate');

    // Check if voting time has expired
    if (votingData.endTime && new Date() > new Date(votingData.endTime)) {
        console.log('Voting time expired, showing results only');
        setupResultsViewer(votingData);
        return;
    }

    const votingInterface = document.getElementById('voting-interface');
    const resultsViewer = document.getElementById('results-viewer');
    const noVotingMessage = document.getElementById('no-voting-message');

    console.log('Elements found:', {
        votingInterface: !!votingInterface,
        resultsViewer: !!resultsViewer,
        noVotingMessage: !!noVotingMessage
    });

    // Show voting interface
    if (votingInterface) votingInterface.style.display = 'block';
    if (resultsViewer) resultsViewer.style.display = 'none';
    if (noVotingMessage) noVotingMessage.style.display = 'none';

    // Set resolution title
    const resolutionTitle = document.getElementById('resolution-title');
    if (resolutionTitle) {
        resolutionTitle.textContent = votingData.title;
        console.log('Resolution title set:', votingData.title);
    } else {
        console.error('Resolution title element not found!');
    }

    // Check if delegate has already voted
    const delegateDoc = await getDoc(doc(db, 'delegates', user));
    const delegateData = delegateDoc.data();

    if (delegateData.currentVote) {
        // Delegate has already voted
        const voteContainer = document.getElementById('vote-buttons-container');
        const confirmationDiv = document.getElementById('vote-confirmation');
        if (voteContainer) voteContainer.style.display = 'none';
        if (confirmationDiv) confirmationDiv.style.display = 'block';
    } else {
        // Setup voting buttons
        const voteContainer = document.getElementById('vote-buttons-container');
        const confirmationDiv = document.getElementById('vote-confirmation');
        if (voteContainer) voteContainer.style.display = 'flex';
        if (confirmationDiv) confirmationDiv.style.display = 'none';

        // Re-enable vote buttons for new session
        const voteInFavourBtn = document.getElementById('vote-in-favour');
        const voteAgainstBtn = document.getElementById('vote-against');
        if (voteInFavourBtn) voteInFavourBtn.disabled = false;
        if (voteAgainstBtn) voteAgainstBtn.disabled = false;

        // Remove existing listeners and add new ones
        if (voteInFavourBtn) voteInFavourBtn.replaceWith(voteInFavourBtn.cloneNode(true));
        if (voteAgainstBtn) voteAgainstBtn.replaceWith(voteAgainstBtn.cloneNode(true));

        // Add new listeners
        const newVoteInFavourBtn = document.getElementById('vote-in-favour');
        const newVoteAgainstBtn = document.getElementById('vote-against');

        if (newVoteInFavourBtn) {
            newVoteInFavourBtn.addEventListener('click', () => submitVote('in_favour', votingData.id));
        }
        if (newVoteAgainstBtn) {
            newVoteAgainstBtn.addEventListener('click', () => submitVote('against', votingData.id));
        }
    }
}

async function setupResultsViewer(votingData) {
    const votingInterface = document.getElementById('voting-interface');
    const resultsViewer = document.getElementById('results-viewer');
    const noVotingMessage = document.getElementById('no-voting-message');

    if (votingInterface) votingInterface.style.display = 'none';
    if (resultsViewer) resultsViewer.style.display = 'block';
    if (noVotingMessage) noVotingMessage.style.display = 'none';

    // Set resolution title
    const resultsTitle = document.getElementById('results-title');
    if (resultsTitle) resultsTitle.textContent = votingData.title;

    // Update vote counts
    const inFavourCount = votingData.results.in_favour || 0;
    const againstCount = votingData.results.against || 0;

    const inFavourCountEl = document.getElementById('in-favour-count');
    const againstCountEl = document.getElementById('against-count');
    if (inFavourCountEl) inFavourCountEl.textContent = inFavourCount;
    if (againstCountEl) againstCountEl.textContent = againstCount;

    // Update chart
    if (votingChart) {
        votingChart.data.datasets[0].data = [inFavourCount, againstCount];
        votingChart.update();
    } else {
        initializeVotingChart();
        setTimeout(() => {
            if (votingChart) {
                votingChart.data.datasets[0].data = [inFavourCount, againstCount];
                votingChart.update();
            }
        }, 100);
    }

    // Show resolution status if published
    if (votingData.status === 'published') {
        const statusDiv = document.getElementById('resolution-status');
        const passed = votingData.results.passed;
        if (statusDiv) {
            statusDiv.textContent = 'RESOLUTION ' + (passed ? 'PASSED' : 'FAILED');
            statusDiv.style.color = passed ? '#2ecc71' : '#e74c3c';
            statusDiv.style.background = passed ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)';
            statusDiv.style.border = `1px solid ${passed ? '#2ecc71' : '#e74c3c'}`;
        }
    } else {
        const resolutionStatus = document.getElementById('resolution-status');
        if (resolutionStatus) resolutionStatus.innerHTML = '';
    }
}

async function submitVote(vote, voteId) {
    try {
        // Check if voting is still active and time hasn't expired
        const voteDoc = await getDoc(doc(db, 'voting', 'activeVote'));
        if (!voteDoc.exists()) {
            alert('VOTING SESSION NOT FOUND');
            return;
        }

        const votingData = voteDoc.data();

        // Check if voting has ended or been published
        if (votingData.status !== 'active') {
            alert('VOTING HAS ENDED');
            return;
        }

        // Check if time has expired
        if (votingData.endTime && new Date() > new Date(votingData.endTime)) {
            alert('VOTING TIME HAS EXPIRED');
            return;
        }

        // Check if delegate has already voted
        const delegateDoc = await getDoc(doc(db, 'delegates', user));
        const delegateData = delegateDoc.data();
        if (delegateData.currentVote) {
            alert('YOU HAVE ALREADY VOTED IN THIS SESSION');
            console.log('Vote duplication prevented for user:', user, 'Current vote:', delegateData.currentVote);
            return;
        }

        // Record the vote
        await setDoc(doc(db, 'delegates', user), {
            currentVote: vote,
            votes: [{
                resolutionId: voteId,
                vote: vote,
                timestamp: new Date()
            }]
        }, { merge: true });

        // Update voting counts
        const newResults = { ...votingData.results };

        if (vote === 'in_favour') {
            newResults.in_favour = (newResults.in_favour || 0) + 1;
        } else {
            newResults.against = (newResults.against || 0) + 1;
        }

        await setDoc(doc(db, 'voting', 'activeVote'), {
            results: newResults
        }, { merge: true });

        // Update UI
        const voteContainer = document.getElementById('vote-buttons-container');
        const confirmationDiv = document.getElementById('vote-confirmation');
        if (voteContainer) voteContainer.style.display = 'none';
        if (confirmationDiv) confirmationDiv.style.display = 'block';

        // Disable vote buttons to prevent multiple submissions
        const voteInFavourBtn = document.getElementById('vote-in-favour');
        const voteAgainstBtn = document.getElementById('vote-against');
        if (voteInFavourBtn) voteInFavourBtn.disabled = true;
        if (voteAgainstBtn) voteAgainstBtn.disabled = true;

    } catch (error) {
        console.error('Error submitting vote:', error);
        alert('ERROR SUBMITTING VOTE. PLEASE TRY AGAIN.');
    }
}

// Additional Resources
const downloadSpecializedBtn = document.getElementById('download-specialized-btn');
if (downloadSpecializedBtn) {
    downloadSpecializedBtn.addEventListener('click', () => {
        // Generate specialized study guide based on allocation
        const allocation = localStorage.getItem('recessus_allocation');
        if (allocation) {
            alert(`SPECIALIZED STUDY GUIDE for ${allocation} - Would contain country-specific briefing materials`);
        } else {
            alert('SPECIALIZED STUDY GUIDE - Please login to access your allocation-specific guide');
        }
    });
}

const viewSourcesBtn = document.getElementById('view-sources-btn');
if (viewSourcesBtn) {
    viewSourcesBtn.addEventListener('click', () => {
        // Show official sources modal or navigate to sources page
        alert('OFFICIAL SOURCES SECTION - Would contain curated documentation and references');
    });
}

const viewTrainingBtn = document.getElementById('view-training-btn');
if (viewTrainingBtn) {
    viewTrainingBtn.addEventListener('click', () => {
        // Show training materials
        alert('TRAINING MATERIALS - Would contain procedural videos and Q&A resources');
    });
}

// Initialize voting system on page load
window.addEventListener('load', () => {
    loadProfileData(); // Load profile data first
    setupVotingInterface();
});
