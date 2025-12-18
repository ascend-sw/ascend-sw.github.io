import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, RotateCcw, Users, Eye, EyeOff, Coffee, HelpCircle, Check, Crown, Plus, Save, LogOut, Copy, ArrowRight, Hash, Menu, List, X, CheckSquare, Trash2, Edit2, MessageSquare, MessageCircle, Link, Sun, Moon } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, deleteField, collection } from 'firebase/firestore';

/**
 * PLANNING POKER COMPONENT - COMPACT LAYOUT + URL SHARING + ANIMATIONS + THEMES + WIDER TABLE DISTRIBUTION
 */

const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
};

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'asd-agile-poker';

// --- Constants & Config ---
const DECK_FIBONACCI = [
    { value: 0, label: '0', color: 'bg-slate-700' },
    { value: 1, label: '1', color: 'bg-emerald-600' },
    { value: 2, label: '2', color: 'bg-emerald-500' },
    { value: 3, label: '3', color: 'bg-teal-500' },
    { value: 5, label: '5', color: 'bg-cyan-500' },
    { value: 8, label: '8', color: 'bg-blue-500' },
    { value: 13, label: '13', color: 'bg-indigo-500' },
    { value: 21, label: '21', color: 'bg-violet-500' },
    { value: 100, label: '100', color: 'bg-purple-600' },
    { value: '?', label: '?', color: 'bg-pink-600' },
    { value: 'coffee', label: '☕', color: 'bg-amber-600' },
];

const FUNNY_MESSAGES = [
    "It works on my machine! 🤷‍♂️",
    "Is this a feature? 🐛",
    "I need more coffee ☕",
    "Estimation or guesstimation? 🎲",
    "One line of code... maybe 🤞",
    "Deploying on Friday? 😱",
    "Can we spike this? 🔨",
    "5 points (emotional damage) 😭",
    "Have you tried restarting? 🔌",
    "LGTM 👍"
];

// --- Helper Components ---

// 1. The Playing Card (Used in Hand and on Table)
const PokerCard = ({ card, isSelected, onClick, isFaceDown, size = 'md', className = '', hoverEffect = true, isDarkMode = true }) => {
    const sizeClasses = {
        sm: 'w-10 h-14 text-xs',
        md: 'w-20 h-28 text-xl',
        lg: 'w-24 h-36 text-2xl',
    };

    const borderColor = isDarkMode ? 'border-slate-600' : 'border-slate-300';
    const shadowColor = isDarkMode ? 'shadow-lg' : 'shadow-xl shadow-slate-300/50';

    const baseClasses = `
    relative rounded-xl border-2 ${shadowColor} cursor-pointer transition-all duration-300 ease-out transform preserve-3d
    flex items-center justify-center font-bold select-none
    ${sizeClasses[size]}
    ${className}
  `;

    // Enhanced hover animations for hand cards - Clean lift and slight scale
    const hoverStyles = hoverEffect
        ? `hover:-translate-y-6 hover:scale-105 hover:border-blue-400 hover:shadow-xl hover:z-20`
        : '';

    const stateClasses = isSelected
        ? 'border-blue-400 -translate-y-6 scale-110 shadow-[0_0_25px_rgba(59,130,246,0.6)] ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900 z-10'
        : `${borderColor} ${hoverStyles}`;

    const CardBack = () => (
        <div
            className={`absolute inset-0 rounded-xl backface-hidden flex items-center justify-center border-2 
        ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-indigo-900 border-indigo-800'}
      `}
            style={{ transform: 'rotateY(180deg)' }}
        >
            <div className={`w-full h-full opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${isDarkMode ? 'from-blue-400 via-slate-900 to-slate-900' : 'from-blue-400 via-indigo-900 to-indigo-950'}`} />
            <div className={`absolute inset-2 border-2 border-dashed rounded-lg opacity-50 ${isDarkMode ? 'border-slate-600' : 'border-indigo-700'}`} />
            <div className="absolute text-blue-500 font-bold text-lg opacity-80">PKR</div>
        </div>
    );

    const CardFront = () => (
        <div className={`absolute inset-0 rounded-xl backface-hidden flex flex-col items-center justify-between p-2 ${card.color} text-white shadow-inner overflow-hidden`}>
            <span className="self-start text-[0.6em] opacity-80 transition-transform duration-300 group-hover:scale-110 group-hover:font-bold">{card.label}</span>
            <span className="text-[1.5em] drop-shadow-md transition-transform duration-300 group-hover:scale-125">{card.label}</span>
            <span className="self-end text-[0.6em] opacity-80 rotate-180 transition-transform duration-300 group-hover:scale-110 group-hover:font-bold">{card.label}</span>

            {/* Simple texture overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-white/20 rounded-xl pointer-events-none" />
        </div>
    );

    return (
        <div className={`perspective-1000 ${hoverEffect ? 'group' : ''}`}>
            <div
                onClick={onClick}
                className={`${baseClasses} ${stateClasses} ${isFaceDown ? (isDarkMode ? 'bg-slate-800' : 'bg-indigo-900') : ''}`}
                style={{ transformStyle: 'preserve-3d', transform: isFaceDown ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
                <CardFront />
                <CardBack />
            </div>
        </div>
    );
};

// 2. Avatar Circle
const Avatar = ({ name, hasVoted, isRevealed, isMe, message, isDarkMode = true }) => {
    const getColor = (str) => {
        if (!str) return 'bg-slate-500';
        const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const textColor = isMe ? 'text-blue-500 font-bold' : (isDarkMode ? 'text-slate-300' : 'text-slate-600 font-semibold');
    const bgBadge = isDarkMode ? 'bg-slate-900/60' : 'bg-white/80 shadow-sm border border-slate-200';

    return (
        <div className="flex flex-col items-center gap-2 transition-all duration-300 relative">
            {/* Message Bubble */}
            {message && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 animate-bounce-in origin-bottom">
                    <div className={`relative ${isDarkMode ? 'bg-white text-slate-900 border-blue-200' : 'bg-slate-800 text-white border-slate-600'} text-xs font-bold px-3 py-2 rounded-xl shadow-xl whitespace-nowrap border-2`}>
                        {message}
                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 border-b-2 border-r-2 transform rotate-45 ${isDarkMode ? 'bg-white border-blue-200' : 'bg-slate-800 border-slate-600'}`}></div>
                    </div>
                </div>
            )}

            <div className={`
        relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-10
        ${getColor(name)}
        ${hasVoted ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900' : 'opacity-90'}
        ${isMe ? 'ring-2 ring-blue-500' : ''}
      `}>
                {name ? name.charAt(0).toUpperCase() : '?'}
                {hasVoted && !isRevealed && (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1 border border-slate-900 animate-bounce">
                        <Check size={10} />
                    </div>
                )}
            </div>
            <span className={`text-xs max-w-[80px] truncate z-20 px-2 py-0.5 rounded-full backdrop-blur-sm ${bgBadge} ${textColor}`}>
        {name} {isMe && '(You)'}
      </span>
        </div>
    );
};

// --- Main Application Component ---

export default function PlanningPokerApp() {
    // --- Local State ---
    const [user, setUser] = useState(null);
    const [myName, setMyName] = useState('Player');
    const [isEditingName, setIsEditingName] = useState(false);

    // Theme State
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Try to get from local storage or default to true
        const saved = localStorage.getItem('planning_poker_theme');
        return saved !== null ? JSON.parse(saved) : true;
    });

    // Room Management
    const [roomId, setRoomId] = useState(null);
    const [joinInput, setJoinInput] = useState('');
    const [copied, setCopied] = useState(false);

    // Track leaving state
    const isLeavingRef = useRef(false);

    // Ticket Management
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [newTicketTitle, setNewTicketTitle] = useState('');

    // Ticket Editing
    const [editingTicketId, setEditingTicketId] = useState(null);
    const [editTitle, setEditTitle] = useState('');

    // Messaging
    const [isMessageMenuOpen, setIsMessageMenuOpen] = useState(false);

    // --- Synced State (from Firestore) ---
    const [roomData, setRoomData] = useState({
        tickets: [],
        activeTicketId: null,
        isRevealed: false,
        participants: {}
    });

    const [showConfetti, setShowConfetti] = useState(false);

    // --- Theme Variables ---
    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        localStorage.setItem('planning_poker_theme', JSON.stringify(newMode));
    };

    const theme = {
        bg: isDarkMode ? 'bg-slate-900' : 'bg-slate-50',
        text: isDarkMode ? 'text-slate-200' : 'text-slate-800',
        textMuted: isDarkMode ? 'text-slate-400' : 'text-slate-500',
        headerBg: isDarkMode ? 'bg-slate-800/50' : 'bg-white/80',
        headerBorder: isDarkMode ? 'border-slate-700' : 'border-slate-200',
        panelBg: isDarkMode ? 'bg-slate-800' : 'bg-white',
        panelBorder: isDarkMode ? 'border-slate-700' : 'border-slate-200',
        inputBg: isDarkMode ? 'bg-slate-900' : 'bg-slate-50',
        sidebarBg: isDarkMode ? 'bg-slate-800/95' : 'bg-white/95',
        tableBg: isDarkMode ? 'bg-slate-800/40' : 'bg-white',
        tableBorder: isDarkMode ? 'border-slate-800' : 'border-slate-200',
        tableInnerBg: isDarkMode ? 'bg-slate-800/80' : 'bg-slate-100',
        tableInnerBorder: isDarkMode ? 'border-slate-700/50' : 'border-slate-200',
        accentText: isDarkMode ? 'text-white' : 'text-slate-900',
    };

    // --- 1. Auth & Initialization ---
    useEffect(() => {
        const initAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        };
        initAuth();

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const savedName = localStorage.getItem('planning_poker_name');
                if (savedName) setMyName(savedName);
            }
        });
        return () => unsubscribe();
    }, []);

    // --- 1.5 URL Handling for Room Sharing ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomFromUrl = params.get('room');
        if (roomFromUrl) {
            setRoomId(roomFromUrl.toUpperCase());
        }
    }, []);

    // --- 1.6 Cleanup on Tab Close ---
    useEffect(() => {
        const handleTabClose = () => {
            if (user && roomId && !isLeavingRef.current) {
                isLeavingRef.current = true;
                const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
                updateDoc(roomRef, {
                    [`participants.${user.uid}`]: deleteField()
                }).catch(err => console.error(err));
            }
        };

        window.addEventListener('beforeunload', handleTabClose);
        return () => window.removeEventListener('beforeunload', handleTabClose);
    }, [user, roomId]);

    // --- 2. Firestore Sync Listener ---
    useEffect(() => {
        if (!user || !roomId) return;

        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);

        const unsubscribe = onSnapshot(roomRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();

                // Data Migration
                if (!data.tickets || data.tickets.length === 0) {
                    const initialTicket = {
                        id: 'default-ticket',
                        title: data.topic || 'General Estimation',
                        score: null,
                        timestamp: Date.now()
                    };
                    updateDoc(roomRef, { tickets: [initialTicket], activeTicketId: 'default-ticket' });
                    return;
                }

                // Auto-join
                if (!isLeavingRef.current && (!data.participants || !data.participants[user.uid])) {
                    updateDoc(roomRef, {
                        [`participants.${user.uid}`]: {
                            id: user.uid,
                            name: localStorage.getItem('planning_poker_name') || myName,
                            vote: null,
                            timestamp: Date.now(),
                            message: null
                        }
                    }).catch(e => console.error("Auto-join error", e));
                }

                setRoomData(data);

                if (data.isRevealed) {
                    checkForConsensus(data.participants);
                } else {
                    setShowConfetti(false);
                }
            } else {
                // Initialize new room
                const firstTicket = { id: crypto.randomUUID(), title: 'First Ticket', score: null, timestamp: Date.now() };
                setDoc(roomRef, {
                    tickets: [firstTicket],
                    activeTicketId: firstTicket.id,
                    isRevealed: false,
                    participants: {
                        [user.uid]: {
                            id: user.uid,
                            name: localStorage.getItem('planning_poker_name') || myName,
                            vote: null,
                            timestamp: Date.now(),
                            message: null
                        }
                    }
                });
            }
        }, (error) => console.error("Sync error:", error));

        return () => unsubscribe();
    }, [user, roomId]);

    // --- 3. Actions ---

    const handleCreateRoom = () => {
        isLeavingRef.current = false;
        const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomId(newId);
    };

    const handleJoinRoom = () => {
        if (joinInput.trim().length > 0) {
            isLeavingRef.current = false;
            const id = joinInput.trim().toUpperCase();
            setRoomId(id);
        }
    };

    const updateMyName = (newName) => {
        setMyName(newName);
        localStorage.setItem('planning_poker_name', newName);
        setIsEditingName(false);
        if (user && roomId && roomData.participants && roomData.participants[user.uid]) {
            const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
            updateDoc(roomRef, { [`participants.${user.uid}.name`]: newName });
        }
    };

    const castVote = async (card) => {
        if (!user || !roomId) return;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        await updateDoc(roomRef, {
            [`participants.${user.uid}`]: {
                id: user.uid,
                name: myName,
                vote: card,
                timestamp: Date.now()
            }
        });
    };

    const handleReveal = async () => {
        if (!roomId) return;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        await updateDoc(roomRef, { isRevealed: true });
    };

    const handleReset = async () => {
        if (!roomId) return;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        const resetParticipants = { ...roomData.participants };
        if (resetParticipants) {
            Object.keys(resetParticipants).forEach(key => {
                if(resetParticipants[key]) resetParticipants[key] = { ...resetParticipants[key], vote: null };
            });
        }
        await updateDoc(roomRef, { isRevealed: false, participants: resetParticipants || {} });
    };

    const handleSelectMessage = async (msg) => {
        if (!user || !roomId) return;
        setIsMessageMenuOpen(false);
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);

        const existingParticipant = roomData.participants?.[user.uid];
        const isCompleteProfile = existingParticipant && existingParticipant.id;

        if (isCompleteProfile) {
            await updateDoc(roomRef, { [`participants.${user.uid}.message`]: msg });
        } else {
            await updateDoc(roomRef, {
                [`participants.${user.uid}`]: {
                    id: user.uid,
                    name: myName,
                    vote: existingParticipant?.vote || null,
                    timestamp: existingParticipant?.timestamp || Date.now(),
                    message: msg
                }
            });
        }

        if (msg) {
            setTimeout(() => {
                if (auth.currentUser) {
                    updateDoc(roomRef, { [`participants.${user.uid}.message`]: null }).catch(e => {});
                }
            }, 8000);
        }
    };

    const handleAddTicket = async (e) => {
        e.preventDefault();
        if (!newTicketTitle.trim() || !roomId) return;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        const newTicket = { id: crypto.randomUUID(), title: newTicketTitle, score: null, timestamp: Date.now() };
        const updatedTickets = [...(roomData.tickets || []), newTicket];
        await updateDoc(roomRef, { tickets: updatedTickets });
        setNewTicketTitle('');
    };

    const handleSetActiveTicket = async (ticketId) => {
        if (!roomId) return;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        const resetParticipants = { ...roomData.participants };
        if (resetParticipants) {
            Object.keys(resetParticipants).forEach(key => {
                if(resetParticipants[key]) resetParticipants[key] = { ...resetParticipants[key], vote: null };
            });
        }
        await updateDoc(roomRef, { activeTicketId: ticketId, isRevealed: false, participants: resetParticipants });
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleSaveScore = async (score) => {
        if (!roomId || !roomData.activeTicketId) return;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        const updatedTickets = roomData.tickets.map(t =>
            t.id === roomData.activeTicketId ? { ...t, score: score } : t
        );
        await updateDoc(roomRef, { tickets: updatedTickets });
    };

    const handleDeleteTicket = async (ticketId, e) => {
        e.stopPropagation();
        if (!roomId) return;
        if (roomData.tickets.length <= 1) return;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        const updatedTickets = roomData.tickets.filter(t => t.id !== ticketId);
        let updates = { tickets: updatedTickets };
        if (roomData.activeTicketId === ticketId) {
            updates.activeTicketId = updatedTickets[0].id;
            updates.isRevealed = false;
        }
        await updateDoc(roomRef, updates);
    };

    const handleStartEdit = (ticket, e) => {
        e.stopPropagation();
        setEditingTicketId(ticket.id);
        setEditTitle(ticket.title);
    };

    const handleCancelEdit = () => {
        setEditingTicketId(null);
        setEditTitle('');
    };

    const handleSaveEdit = async (ticketId) => {
        if (!roomId || !editTitle.trim()) return;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        const updatedTickets = roomData.tickets.map(t =>
            t.id === ticketId ? { ...t, title: editTitle.trim() } : t
        );
        await updateDoc(roomRef, { tickets: updatedTickets });
        setEditingTicketId(null);
        setEditTitle('');
    };

    const handleLeave = async () => {
        if (!user || !roomId) return;
        isLeavingRef.current = true;
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'planning_poker_boards', roomId);
        try { await updateDoc(roomRef, { [`participants.${user.uid}`]: deleteField() }); } catch (e) {}
        setRoomId(null);
        setRoomData({ tickets: [], activeTicketId: null, isRevealed: false, participants: {} });
        setTimeout(() => { isLeavingRef.current = false; }, 100);
    };

    const copyRoomLink = () => {
        const url = `${window.location.href.split('?')[0]}?room=${roomId}`;
        const el = document.createElement('textarea');
        el.value = url;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) {}
        document.body.removeChild(el);
    };

    // --- 4. Logic & Computation ---

    const participantsList = useMemo(() => {
        return Object.values(roomData.participants || {})
            .filter(p => p && p.id)
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [roomData.participants]);

    const activeTicket = useMemo(() => {
        return roomData.tickets?.find(t => t.id === roomData.activeTicketId) || { title: 'No Ticket Selected' };
    }, [roomData.tickets, roomData.activeTicketId]);

    const myVote = user && roomData.participants?.[user.uid]?.vote;

    const checkForConsensus = (participantsMap) => {
        if (!participantsMap) return;
        const votes = Object.values(participantsMap)
            .filter(p => p.vote && typeof p.vote.value === 'number')
            .map(p => p.vote.value);

        if (votes.length > 1) {
            const allEqual = votes.every(v => v === votes[0]);
            if (allEqual) setShowConfetti(true);
        }
    };

    const stats = useMemo(() => {
        if (!roomData.isRevealed) return null;
        const numericVotes = participantsList
            .filter(p => p.vote && typeof p.vote.value === 'number')
            .map(p => p.vote.value);

        if (numericVotes.length === 0) return null;

        const sum = numericVotes.reduce((a, b) => a + b, 0);
        const avg = (sum / numericVotes.length).toFixed(1);
        const max = Math.max(...numericVotes);
        const min = Math.min(...numericVotes);

        return { avg, max, min };
    }, [participantsList, roomData.isRevealed]);

    const isConsensus = stats && stats.max === stats.min;


    // --- Render: LOBBY View ---
    if (!roomId) {
        return (
            <div className={`min-h-screen ${theme.bg} ${theme.text} font-sans flex flex-col items-center justify-center p-4 transition-colors duration-500`}>
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {isDarkMode ? (
                        <>
                            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700" />
                        </>
                    ) : (
                        <>
                            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl animate-pulse delay-700" />
                        </>
                    )}
                </div>

                <button
                    onClick={toggleTheme}
                    className={`absolute top-6 right-6 p-3 rounded-full ${theme.panelBg} shadow-lg border ${theme.panelBorder} transition-all z-20`}
                >
                    {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-slate-600" />}
                </button>

                <div className={`z-10 w-full max-w-md ${isDarkMode ? 'bg-slate-800/50' : 'bg-white/80'} backdrop-blur-xl border ${theme.panelBorder} rounded-3xl p-8 shadow-2xl`}>
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg shadow-blue-500/30">
                            <Users size={32} className="text-white" />
                        </div>
                        <h1 className={`text-3xl font-bold ${theme.accentText} mb-2`}>Planning Poker</h1>
                        <p className={theme.textMuted}>Real-time estimation for agile teams</p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className={`block text-xs font-semibold ${theme.textMuted} uppercase tracking-wider mb-2`}>Your Name</label>
                            <input
                                type="text"
                                value={myName}
                                onChange={(e) => {
                                    setMyName(e.target.value);
                                    localStorage.setItem('planning_poker_name', e.target.value);
                                }}
                                className={`w-full ${theme.inputBg} border ${theme.panelBorder} rounded-xl px-4 py-3 ${theme.accentText} focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                                placeholder="Enter your name"
                            />
                        </div>

                        <div className={`h-px ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-200'} my-4`} />

                        <button
                            onClick={handleCreateRoom}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-blue-600/20"
                        >
                            <Plus size={20} />
                            Create New Room
                        </button>

                        <div className="relative text-center my-2">
                            <span className={`${isDarkMode ? 'bg-slate-800/0' : 'bg-transparent'} px-2 text-xs ${theme.textMuted} font-medium`}>OR JOIN EXISTING</span>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Hash className={`absolute left-3 top-3.5 ${theme.textMuted}`} size={16} />
                                <input
                                    type="text"
                                    value={joinInput}
                                    onChange={(e) => setJoinInput(e.target.value)}
                                    className={`w-full ${theme.inputBg} border ${theme.panelBorder} rounded-xl pl-10 pr-4 py-3 ${theme.accentText} focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all uppercase placeholder:normal-case`}
                                    placeholder="Room ID"
                                />
                            </div>
                            <button
                                onClick={handleJoinRoom}
                                disabled={!joinInput.trim()}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold p-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                            >
                                <ArrowRight size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Render: GAME View ---

    return (
        <div className={`min-h-screen ${theme.bg} ${theme.text} font-sans selection:bg-blue-500 selection:text-white flex flex-col overflow-hidden transition-colors duration-500`}>

            {/* --- Header --- */}
            <header className={`px-6 py-4 ${theme.headerBg} backdrop-blur-md border-b ${theme.headerBorder} flex flex-wrap md:flex-nowrap items-center justify-between z-10 gap-4 fixed top-0 w-full transition-colors duration-500`}>
                <div className="flex items-center gap-3 min-w-fit">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                        <Users size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className={`font-bold text-lg leading-tight ${theme.accentText} tracking-wide`}>Agile<span className="text-blue-400">Poker</span></h1>
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={copyRoomLink} title="Click to copy Invite Link">
                            <span className={`text-xs ${theme.textMuted}`}>Room: <span className="font-mono text-emerald-400 font-bold">{roomId}</span></span>
                            {copied ? (
                                <span className="text-[10px] text-emerald-400 font-bold animate-pulse">LINK COPIED!</span>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <Link size={12} className={`${theme.textMuted} group-hover:${theme.accentText} transition-colors`} />
                                    <span className={`text-[10px] ${theme.textMuted} group-hover:${theme.textMuted} opacity-80`}>Share</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Current Topic Display */}
                <div className="flex-1 w-full md:w-auto md:max-w-xl md:mx-8 order-3 md:order-2 text-center">
                    <div className="inline-flex flex-col">
                        <span className={`text-[10px] ${theme.textMuted} uppercase tracking-widest font-semibold`}>Estimating</span>
                        <h2 className={`text-lg font-bold ${theme.accentText} truncate max-w-[200px] md:max-w-md`}>{activeTicket.title}</h2>
                    </div>
                </div>

                <div className="flex items-center gap-3 order-2 md:order-3 min-w-fit justify-end relative">

                    <button
                        onClick={toggleTheme}
                        className={`p-2 rounded-full transition-colors border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'}`}
                    >
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    {/* Message Menu Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsMessageMenuOpen(!isMessageMenuOpen)}
                            className={`p-2 rounded-full transition-colors border ${isMessageMenuOpen ? 'bg-pink-600 border-pink-500 text-white' : `${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'}`}`}
                            title="Say something..."
                        >
                            <MessageSquare size={20} />
                        </button>

                        {/* Message Dropdown */}
                        {isMessageMenuOpen && (
                            <div className={`absolute top-12 right-0 w-64 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in-up`}>
                                <div className={`p-3 border-b ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                                    <span className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider`}>Quick Messages</span>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {FUNNY_MESSAGES.map((msg, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSelectMessage(msg)}
                                            className={`w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700/50' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-100'} transition-colors border-b last:border-0`}
                                        >
                                            {msg}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => handleSelectMessage(null)}
                                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/10 transition-colors"
                                    >
                                        Clear Message
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`p-2 rounded-full transition-colors border ${isSidebarOpen ? 'bg-blue-600 border-blue-500 text-white' : `${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'}`}`}
                    >
                        <List size={20} />
                    </button>

                    {/* Name Editor */}
                    {isEditingName ? (
                        <div className={`flex items-center ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'} rounded-full px-2 py-1 border`}>
                            <input
                                autoFocus
                                className={`bg-transparent border-none text-xs ${theme.accentText} focus:ring-0 w-24 outline-none`}
                                value={myName}
                                onChange={(e) => setMyName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && updateMyName(myName)}
                                onBlur={() => updateMyName(myName)}
                            />
                            <button onClick={() => updateMyName(myName)} className="text-emerald-500 hover:text-emerald-400 p-1"><Check size={12}/></button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditingName(true)}
                            className={`hidden md:flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-white hover:bg-slate-50 border-slate-200'} px-3 py-1.5 rounded-full text-xs font-medium transition-colors border`}
                        >
                            <span className={theme.textMuted}>Name:</span>
                            <span className={theme.accentText}>{myName}</span>
                        </button>
                    )}

                    <button
                        onClick={handleLeave}
                        title="Leave Room"
                        className={`p-2 ${theme.textMuted} hover:text-red-400 transition-colors`}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* --- Ticket Sidebar --- */}
            <div
                className={`fixed inset-y-0 right-0 w-full sm:w-96 ${theme.sidebarBg} backdrop-blur-xl border-l ${theme.panelBorder} shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="flex flex-col h-full pt-20">
                    {/* Sidebar Header */}
                    <div className={`p-4 border-b ${theme.panelBorder} flex items-center justify-between`}>
                        <h3 className={`font-bold ${theme.accentText} flex items-center gap-2`}>
                            <List size={18} className="text-blue-400"/>
                            Tickets Backlog
                            <span className={`${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'} text-[10px] px-2 py-0.5 rounded-full`}>{roomData.tickets?.length || 0}</span>
                        </h3>
                        <button onClick={() => setIsSidebarOpen(false)} className={`${theme.textMuted} hover:${theme.accentText} p-1`}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Add Ticket Input */}
                    <div className={`p-4 border-b ${theme.panelBorder} ${isDarkMode ? 'bg-slate-900/30' : 'bg-slate-50'}`}>
                        <form onSubmit={handleAddTicket} className="flex gap-2">
                            <input
                                type="text"
                                value={newTicketTitle}
                                onChange={(e) => setNewTicketTitle(e.target.value)}
                                placeholder="New ticket title..."
                                className={`flex-1 ${theme.inputBg} border ${theme.panelBorder} rounded-lg px-3 py-2 text-sm ${theme.accentText} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <button
                                type="submit"
                                disabled={!newTicketTitle.trim()}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-2 rounded-lg"
                            >
                                <Plus size={18} />
                            </button>
                        </form>
                    </div>

                    {/* Ticket List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {roomData.tickets?.map((ticket) => {
                            const isActive = ticket.id === roomData.activeTicketId;
                            const isEditing = editingTicketId === ticket.id;

                            if (isEditing) {
                                return (
                                    <div key={ticket.id} className={`p-3 rounded-xl border border-blue-500/50 ${isDarkMode ? 'bg-slate-900/80' : 'bg-white shadow-md'}`}>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className={`flex-1 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'} border rounded px-2 py-1.5 text-sm ${theme.accentText} focus:outline-none focus:border-blue-500`}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit(ticket.id);
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                            />
                                            <div className="flex gap-1">
                                                <button onClick={() => handleSaveEdit(ticket.id)} className="text-emerald-400 hover:bg-emerald-400/10 p-1.5 rounded"><Check size={16}/></button>
                                                <button onClick={handleCancelEdit} className="text-slate-400 hover:bg-slate-700 p-1.5 rounded"><X size={16}/></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={ticket.id}
                                    className={`group relative p-3 rounded-xl border transition-all ${isActive ? 'bg-blue-500/10 border-blue-500/50' : `${isDarkMode ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'}`}`}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => handleSetActiveTicket(ticket.id)}
                                        >
                                            <h4 className={`text-sm font-medium ${isActive ? 'text-blue-500 font-bold' : theme.accentText}`}>{ticket.title}</h4>
                                            <div className="flex items-center gap-2 mt-2">
                                                {ticket.score !== null ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full border border-emerald-500/20">
                            <CheckSquare size={10} /> Score: {ticket.score}
                          </span>
                                                ) : (
                                                    <span className={`text-[10px] ${theme.textMuted} flex items-center gap-1`}>
                             <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-slate-600' : 'bg-slate-400'}`}></div> Pending
                          </span>
                                                )}
                                                {isActive && <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Active</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

                                            <button
                                                onClick={(e) => handleStartEdit(ticket, e)}
                                                className={`p-1.5 ${theme.textMuted} hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors`}
                                                title="Edit Ticket"
                                            >
                                                <Edit2 size={14} />
                                            </button>

                                            <button
                                                onClick={(e) => handleDeleteTicket(ticket.id, e)}
                                                className={`p-1.5 ${theme.textMuted} hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors`}
                                                title="Delete Ticket"
                                            >
                                                <Trash2 size={14} />
                                            </button>

                                            {!isActive && (
                                                <button
                                                    onClick={() => handleSetActiveTicket(ticket.id)}
                                                    className={`p-1.5 ${theme.textMuted} hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors`}
                                                    title="Estimate This"
                                                >
                                                    <Play size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- Main Game Area --- */}
            <main className="flex-1 relative flex flex-col items-center justify-center p-4 pt-24 md:pt-28">

                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {isDarkMode ? (
                        <>
                            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700" />
                        </>
                    ) : (
                        <>
                            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl animate-pulse delay-700" />
                        </>
                    )}
                </div>

                {/* --- The Table --- */}
                <div
                    className={`
            relative w-full max-w-4xl aspect-[16/9] md:aspect-[2.2/1] rounded-[3rem] 
            border-8 shadow-2xl flex items-center justify-center backdrop-blur-sm transition-all duration-1000
            ${isConsensus
                        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]'
                        : `${theme.tableBg} ${theme.tableBorder}`
                    }
          `}
                >
                    {/* Table Felt/Surface */}
                    <div
                        className={`
              absolute inset-2 rounded-[2.5rem] shadow-inner border flex flex-col items-center justify-center transition-all duration-1000 overflow-hidden
              ${isConsensus
                            ? `border-emerald-500/20 ${isDarkMode ? 'bg-slate-800/90' : 'bg-emerald-50'}`
                            : `${theme.tableInnerBg} ${theme.tableInnerBorder}`
                        }
            `}
                    >
                        {/* Consensus Pulse Effect */}
                        {isConsensus && (
                            <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] overflow-hidden">
                                <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" style={{ animationDuration: '4s' }} />
                            </div>
                        )}

                        {/* Table Center Info / Actions */}
                        <div className={`flex flex-col items-center gap-4 z-10 p-4 rounded-xl backdrop-blur-sm border transition-all duration-500 min-w-[200px] ${isConsensus ? `${isDarkMode ? 'bg-slate-900/80 border-emerald-500/20' : 'bg-white/90 border-emerald-200'} shadow-lg shadow-emerald-500/10` : `${isDarkMode ? 'bg-slate-900/50' : 'bg-white/60'} ${theme.tableInnerBorder}`}`}>
                            {!roomData.isRevealed ? (
                                <div className="flex flex-col items-center animate-fade-in-up">
                                    <div className={`text-xl md:text-3xl font-black ${theme.textMuted} tracking-widest mb-2`}>VOTING</div>
                                    <button
                                        onClick={handleReveal}
                                        disabled={participantsList.filter(p => p.vote).length === 0}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 md:px-8 md:py-3 rounded-full font-bold shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-sm md:text-base"
                                    >
                                        <Eye size={20} /> Reveal Cards
                                    </button>
                                    <p className={`mt-3 ${theme.textMuted} text-xs md:text-sm`}>
                                        {participantsList.filter(p => p.vote).length} of {participantsList.length} voted
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center animate-fade-in-up">
                                    {stats ? (
                                        <div className="flex items-center gap-6 mb-4">
                                            <div className="text-center">
                                                <div className={`text-[10px] ${theme.textMuted} uppercase tracking-wider font-semibold`}>Average</div>
                                                <div className={`text-3xl md:text-4xl font-black ${isDarkMode ? 'text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400' : 'text-slate-800'}`}>{stats.avg}</div>
                                            </div>
                                            <div className={`w-px h-10 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`} />
                                            <div className="text-center">
                                                <div className={`text-[10px] ${theme.textMuted} uppercase tracking-wider font-semibold`}>Consensus</div>
                                                <div className={`text-lg font-bold ${theme.accentText}`}>
                                                    {stats.max === stats.min ? <span className="text-emerald-500">Yes!</span> : <span className="text-orange-500">No</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`mb-4 ${theme.textMuted} italic`}>No votes cast</div>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleReset}
                                            className={`${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} text-white px-4 py-2 rounded-full font-bold transition-all text-sm flex items-center gap-2`}
                                        >
                                            <RotateCcw size={16} /> Re-vote
                                        </button>

                                        {stats && (
                                            <button
                                                onClick={() => {
                                                    handleSaveScore(stats.max === stats.min ? stats.max : stats.avg);
                                                    setIsSidebarOpen(true);
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-full font-bold transition-all text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                                            >
                                                <Save size={16} /> Save Score
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confetti */}
                        {showConfetti && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                {[...Array(20)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            top: `${Math.random() * 100}%`,
                                            animationDelay: `${Math.random() * 2}s`,
                                            animationDuration: '1s'
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* --- Player Slots Positioned Around Table --- */}

                    {/* ME (Fixed at Bottom Center) */}
                    <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-50">
                        <div className={`transition-all duration-500 ${myVote ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            {myVote && (
                                <PokerCard
                                    card={myVote}
                                    isSelected={false}
                                    isFaceDown={!roomData.isRevealed}
                                    size="md"
                                    hoverEffect={false}
                                    isDarkMode={isDarkMode}
                                />
                            )}
                        </div>
                        <Avatar name={myName} hasVoted={!!myVote} isRevealed={roomData.isRevealed} isMe={true} message={roomData.participants?.[user?.uid]?.message} isDarkMode={isDarkMode} />
                    </div>

                    {/* OTHERS (Distributed in Arc) */}
                    {participantsList.filter(p => p.id !== user?.uid).map((player, index, arr) => {
                        // Arc logic - Adjusted for wider distribution around the table
                        const total = arr.length;
                        const spread = 240; // Increased spread from 140 to 240 degrees to use sides
                        const angleStep = spread / (total + 1);
                        const startAngle = -(spread / 2);
                        const angle = startAngle + (angleStep * (index + 1));

                        const rad = (angle - 90) * (Math.PI / 180);
                        const radius = 42;
                        const left = 50 + (radius * Math.cos(rad));
                        const top = 50 + (radius * Math.sin(rad));

                        // Z-index based on vertical position (lower down = closer = higher z-index)
                        // Top of table is ~8%, Bottom is ~92%.
                        // We want players at the bottom (sides) to overlap players at the top (back)
                        const zIndex = 30 + Math.floor(top);

                        return (
                            <div
                                key={player.id}
                                className="absolute flex flex-col items-center justify-center transition-all duration-500"
                                style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: zIndex
                                }}
                            >
                                {/* Card on Table - Adjusted position since player is closer now */}
                                <div
                                    className={`
                    absolute transition-all duration-500
                    ${player.vote ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
                  `}
                                    style={{
                                        // Move card towards center relative to avatar.
                                        // Since avatar is at 42%, we push card 70px towards center.
                                        transform: `translate(${-Math.cos(rad) * 70}px, ${-Math.sin(rad) * 70}px)`,
                                        zIndex: -1
                                    }}
                                >
                                    {player.vote && (
                                        <PokerCard
                                            card={player.vote}
                                            isSelected={false}
                                            isFaceDown={!roomData.isRevealed}
                                            size="sm"
                                            hoverEffect={false}
                                            isDarkMode={isDarkMode}
                                        />
                                    )}
                                </div>

                                <Avatar name={player.name} hasVoted={!!player.vote} isRevealed={roomData.isRevealed} isMe={false} message={player.message} isDarkMode={isDarkMode} />
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* --- Hand Area (Fixed Bottom) --- */}
            <div className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-t p-6 z-30 shadow-2xl transition-colors duration-500`}>
                <div className="max-w-6xl mx-auto flex flex-col items-center gap-2">
                    <div className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-widest mb-2`}>
                        {roomData.isRevealed ? 'Waiting for next round...' : 'Choose your estimate'}
                    </div>

                    <div className={`flex gap-3 overflow-x-auto pt-8 pb-4 px-4 w-full justify-start md:justify-center scrollbar-hide mask-fade transition-opacity duration-300 ${roomData.isRevealed ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                        {DECK_FIBONACCI.map((card) => (
                            <div key={card.label} className="flex-shrink-0">
                                <PokerCard
                                    card={card}
                                    isSelected={myVote?.label === card.label}
                                    isFaceDown={false}
                                    onClick={() => !roomData.isRevealed && castVote(card)}
                                    hoverEffect={true}
                                    isDarkMode={isDarkMode}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- CSS Helpers --- */}
            <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes bounce-in {
            0% { transform: translate(-50%, 20px) scale(0); opacity: 0; }
            50% { transform: translate(-50%, -5px) scale(1.1); }
            100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        .animate-bounce-in {
            animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
        </div>
    );
}