// Voting System Utilities
// This file contains shared voting functionality that can be used across different components

export class VotingManager {
    constructor(db) {
        this.db = db;
        this.listeners = new Map();
    }

    // Subscribe to voting session updates
    onVotingSessionChange(callback) {
        const unsubscribe = this.onSnapshot(this.db.collection('voting').doc('activeVote'), callback);
        this.listeners.set('votingSession', unsubscribe);
        return unsubscribe;
    }

    // Subscribe to delegate vote updates
    onDelegateVoteChange(delegateId, callback) {
        const unsubscribe = this.onSnapshot(this.db.collection('delegates').doc(delegateId), callback);
        this.listeners.set(`delegate_${delegateId}`, unsubscribe);
        return unsubscribe;
    }

    // Submit a vote for a delegate
    async submitVote(delegateId, vote, voteId) {
        try {
            // Record the vote in delegate document
            await this.db.collection('delegates').doc(delegateId).set({
                currentVote: vote,
                votes: [{
                    resolutionId: voteId,
                    vote: vote,
                    timestamp: new Date()
                }]
            }, { merge: true });

            // Update voting counts
            const voteDoc = await this.db.collection('voting').doc('activeVote').get();
            if (voteDoc.exists) {
                const votingData = voteDoc.data();
                const newResults = { ...votingData.results };
                
                if (vote === 'in_favour') {
                    newResults.in_favour = (newResults.in_favour || 0) + 1;
                } else if (vote === 'against') {
                    newResults.against = (newResults.against || 0) + 1;
                }
                
                await this.db.collection('voting').doc('activeVote').set({
                    results: newResults
                }, { merge: true });
            }

            return { success: true };
        } catch (error) {
            console.error('Error submitting vote:', error);
            return { success: false, error: error.message };
        }
    }

    // Start a new voting session
    async startVotingSession(title, timeLimitMinutes) {
        try {
            const voteId = `vote_${Date.now()}`;
            const endTime = new Date(Date.now() + (timeLimitMinutes * 60 * 1000));
            
            await this.db.collection('voting').doc('activeVote').set({
                id: voteId,
                title: title,
                startTime: new Date(),
                endTime: endTime,
                status: 'active',
                results: { in_favour: 0, against: 0, passed: false }
            });

            // Reset all delegate votes for new session
            const delegatesSnapshot = await this.db.collection('delegates').get();
            const batch = this.db.batch();
            
            delegatesSnapshot.forEach(delegateDoc => {
                batch.update(delegateDoc.ref, {
                    currentVote: null
                });
            });
            
            await batch.commit();

            return { success: true, voteId };
        } catch (error) {
            console.error('Error starting voting session:', error);
            return { success: false, error: error.message };
        }
    }

    // End current voting session
    async endVotingSession() {
        try {
            await this.db.collection('voting').doc('activeVote').set({
                status: 'ended'
            }, { merge: true });

            return { success: true };
        } catch (error) {
            console.error('Error ending voting session:', error);
            return { success: false, error: error.message };
        }
    }

    // Publish voting results
    async publishVotingResults() {
        try {
            const voteDoc = await this.db.collection('voting').doc('activeVote').get();
            if (voteDoc.exists) {
                const data = voteDoc.data();
                const passed = data.results.in_favour > data.results.against;
                
                await this.db.collection('voting').doc('activeVote').set({
                    status: 'published',
                    results: { ...data.results, passed: passed }
                }, { merge: true });
            }

            return { success: true };
        } catch (error) {
            console.error('Error publishing voting results:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all delegates with their voting status
    async getAllDelegatesWithVotes() {
        try {
            const delegatesSnapshot = await this.db.collection('delegates').get();
            const delegates = [];
            
            delegatesSnapshot.forEach(doc => {
                const data = doc.data();
                delegates.push({
                    id: doc.id,
                    ...data
                });
            });
            
            return { success: true, delegates };
        } catch (error) {
            console.error('Error getting delegates:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if a delegate can vote
    canDelegateVote(delegateData) {
        return delegateData.is_voting === true && 
               delegateData.attendance === 'present_and_voting' && 
               !delegateData.currentVote;
    }

    // Get voting statistics
    async getVotingStatistics() {
        try {
            const voteDoc = await this.db.collection('voting').doc('activeVote').get();
            if (!voteDoc.exists) {
                return { success: false, error: 'No active voting session' };
            }

            const votingData = voteDoc.data();
            const delegatesSnapshot = await this.db.collection('delegates').get();
            
            let totalDelegates = 0;
            let votingDelegates = 0;
            let votedDelegates = 0;
            let inFavourCount = 0;
            let againstCount = 0;

            delegatesSnapshot.forEach(doc => {
                const data = doc.data();
                totalDelegates++;
                
                if (data.is_voting) {
                    votingDelegates++;
                    
                    if (data.currentVote) {
                        votedDelegates++;
                        
                        if (data.currentVote === 'in_favour') {
                            inFavourCount++;
                        } else if (data.currentVote === 'against') {
                            againstCount++;
                        }
                    }
                }
            });

            return {
                success: true,
                statistics: {
                    totalDelegates,
                    votingDelegates,
                    votedDelegates,
                    inFavourCount,
                    againstCount,
                    turnout: votingDelegates > 0 ? (votedDelegates / votingDelegates * 100).toFixed(1) : 0,
                    session: votingData
                }
            };
        } catch (error) {
            console.error('Error getting voting statistics:', error);
            return { success: false, error: error.message };
        }
    }

    // Clean up all listeners
    cleanup() {
        this.listeners.forEach(unsubscribe => {
            unsubscribe();
        });
        this.listeners.clear();
    }

    // Helper method for onSnapshot (to be imported from Firebase)
    onSnapshot(docRef, callback) {
        // This should be replaced with actual Firebase onSnapshot import
        return docRef.onSnapshot(callback);
    }
}

// Chart utilities for voting visualization
export class VotingChartManager {
    constructor(chartElement) {
        this.chart = null;
        this.chartElement = chartElement;
    }

    initializeChart() {
        if (!this.chartElement) return;

        this.chart = new Chart(this.chartElement, {
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
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            family: 'Share Tech Mono',
                            size: 14
                        },
                        bodyFont: {
                            family: 'Share Tech Mono',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' votes';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#ffffff',
                            font: {
                                family: 'Share Tech Mono',
                                size: 12
                            },
                            stepSize: 1
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#ffffff',
                            font: {
                                family: 'Share Tech Mono',
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }

    updateChart(inFavour, against) {
        if (!this.chart) return;

        this.chart.data.datasets[0].data = [inFavour, against];
        this.chart.update('active'); // Use 'active' mode for smooth animations
    }

    destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Time utilities for voting sessions
export class VotingTimeManager {
    static getTimeRemaining(endTime) {
        const now = new Date();
        const end = new Date(endTime);
        const remaining = end - now;

        if (remaining <= 0) {
            return { expired: true, formatted: 'VOTING ENDED' };
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        return {
            expired: false,
            minutes,
            seconds,
            formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`
        };
    }

    static formatDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const duration = end - start;

        const minutes = Math.floor(duration / 60000);
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
}
