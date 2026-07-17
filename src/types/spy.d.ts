/**
 * @typedef {'draft' | 'lobby' | 'describe' | 'playing' | 'sabotage_alert' | 'vote' | 'tie_debate' | 'tie_revote' | 'reveal' | 'finished'} SpySessionStatus
 * @typedef {'civilians' | 'spies'} SpyOutcome
 * @typedef {'word' | 'crew'} SpyMode
 *
 * @typedef {Object} SpyLastTieBreak
 * @property {string[]} candidateIds
 * @property {string} pickedId
 * @property {string} pickedName
 * @property {'random'} method
 * @property {boolean} votesChanged
 *
 * @typedef {Object} SpySession
 * @property {string} id
 * @property {string} classCode
 * @property {SpySessionStatus} status
 * @property {number} stateVersion
 * @property {number} impostorCount
 * @property {string[]} presentStudentIds
 * @property {string[]} activePlayerIds
 * @property {string[]} describeOrder
 * @property {number} describeIndex
 * @property {number} describeRoundTotal
 * @property {number} describeRoundCurrent
 * @property {string[]} eliminatedIds
 * @property {number} voteRound
 * @property {string} lastEliminatedId
 * @property {SpyOutcome | null} outcome
 * @property {string} civilianWord
 * @property {string} spyWord
 * @property {string[]} revealedSpyIds
 * @property {string[]} tieCandidateIds
 * @property {number} tieDebateIndex
 * @property {import('firebase/firestore').Timestamp | Date | null} tieDebateEndsAt
 * @property {Record<string, string>} tieRevoteBaseline
 * @property {SpyLastTieBreak | null} lastTieBreak
 * @property {SpyMode} mode
 * @property {number} taskPerPlayer
 * @property {number} crewTaskTarget
 * @property {boolean} sabotageActive
 * @property {string} sabotageById
 * @property {import('firebase/firestore').Timestamp | Date | null} sabotageAt
 * @property {import('firebase/firestore').Timestamp | Date | null} sabotageCooldownUntil
 * @property {string[]} reportedByIds
 * @property {'admin' | 'report' | ''} meetingOpenedBy
 * @property {string} meetingReporterId
 *
 * @typedef {Object} SpyParticipant
 * @property {string} id
 * @property {string} studentName
 * @property {string} assignedWord
 * @property {boolean} isSpy
 * @property {boolean} eliminated
 *
 * @typedef {Object} SpyTaskProgress
 * @property {string} id
 * @property {number} total
 * @property {number} completedCount
 * @property {import('firebase/firestore').Timestamp | Date | null} updatedAt
 */

export {};
