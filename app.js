import { db, storage } from './firebase-config.js';
import { collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Users will be loaded from Firestore

let currentUser = null;
let selectedRecipient = null;
let selectedMood = null;
let letters = [];

window.onload = function() {
    console.log('Page loaded');
    initializeLetters();
    checkAutoLogin();
}

async function initializeLetters() {
    console.log('Initializing letters from Firebase...');
    await loadLettersFromFirebase();
    
    if (letters.length === 0) {
        console.log('No letters, loading demo');
        loadDemoLetters();
    }
}

async function loadLettersFromFirebase() {
    const lettersRef = collection(db, "letters");
    const q = query(lettersRef, orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    
    letters = [];
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        letters.push({
            id: docSnap.id,
            ...data,
            date: data.date?.toDate().toISOString() || new Date().toISOString(),
            deliveryTime: data.deliveryTime || new Date().toISOString(),
            readAt: data.readAt?.toDate().toISOString() || null
        });
    });
    
    console.log('Loaded from Firebase:', letters.length);
}

function loadDemoLetters() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    letters = [
        {
            id: 1,
            from: 'maria',
            to: 'alex',
            message: 'Buna! Cum a fost ziua ta? Eu am fost la mare si am facut niste poze frumoase. Imi este dor de tine si sper sa ne vedem curand. Ai grija de tine!',
            mood: 'fericit',
            photos: [],
            date: yesterday.toISOString(),
            deliveryTime: yesterday.toISOString(),
            read: false,
            readAt: null
        },
        {
            id: 2,
            from: 'alex',
            to: 'maria',
            message: 'Iti multumesc pentru mesaj! Si mie imi este dor. Am fost ocupat cu munca dar ma gandesc des la tine. Poate diseara vorbim?',
            mood: 'ganditor',
            photos: [],
            date: lastWeek.toISOString(),
            deliveryTime: lastWeek.toISOString(),
            read: true,
            readAt: new Date(lastWeek.getTime() + 3600000).toISOString()
        },
        {
            id: 3,
            from: 'maria',
            to: 'alex',
            message: 'Uite ce apus frumos am vazut azi! M-am gandit la tine cand l-am vazut. Sper ca esti bine.',
            mood: 'nostalgic',
            photos: ['https://images.unsplash.com/photo-1495954484750-af469f2f9be5?w=400', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'],
            date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            deliveryTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            read: false,
            readAt: null
        }
    ];
    
    console.log('Demo letters loaded:', letters.length);
}

async function checkAutoLogin() {
    const savedUser = localStorage.getItem('currentUser');
    console.log('Saved user:', savedUser);
    
    if (savedUser) {
        currentUser = savedUser;
        showMainApp();
    }
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        alert('Te rog completeaza ambele campuri!');
        return;
    }
    
    try {
        // Check if user exists
        const userDoc = await getDocs(query(collection(db, "users"), where("username", "==", username)));
        
        if (!userDoc.empty) {
            // User exists - check password
            const userData = userDoc.docs[0].data();
            if (userData.password === password) {
                currentUser = username;
                localStorage.setItem('currentUser', username);
                showMainApp();
            } else {
                alert('Parola gresita!');
            }
        } else {
            // User doesn't exist - create new account
            if (confirm(`Username "${username}" nu exista. Vrei sa creezi cont nou?`)) {
                await addDoc(collection(db, "users"), {
                    username: username,
                    password: password,
                    friends: []
                });
                currentUser = username;
                localStorage.setItem('currentUser', username);
                showMainApp();
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Eroare la login. Verifica consola!');
    }
}

function showMainApp() {
    console.log('Showing main app for:', currentUser);
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    setupRecipients();
    setupMoodTags();
    setupDeliveryTime();
    renderInbox();
    renderArchive();
}
async function setupRecipients() {
    // Get current user's friends from Firestore
    const userQuery = query(collection(db, "users"), where("username", "==", currentUser));
    const userSnapshot = await getDocs(userQuery);
    
    let friends = [];
    if (!userSnapshot.empty) {
        friends = userSnapshot.docs[0].data().friends || [];
    }
    
    console.log('Friends:', friends);
    
    const buttonsContainer = document.getElementById('recipientsButtons');
    const dropdown = document.getElementById('recipientDropdown');
    
    if (friends.length === 0) {
        buttonsContainer.innerHTML = '<p style="color:#999;">Niciun prieten adaugat. Adauga prieteni!</p>';
        return;
    }
    
    if (friends.length <= 3) {
        buttonsContainer.style.display = 'flex';
        dropdown.style.display = 'none';
        
        buttonsContainer.innerHTML = '';
        friends.forEach(rec => {
            const btn = document.createElement('button');
            btn.textContent = `📨 ${rec}`;
            btn.onclick = () => selectRecipient(rec, btn);
            buttonsContainer.appendChild(btn);
        });
    } else {
        buttonsContainer.style.display = 'none';
        dropdown.style.display = 'block';
        
        dropdown.innerHTML = '<option value="">Selecteaza destinatar...</option>';
        friends.forEach(rec => {
            const opt = document.createElement('option');
            opt.value = rec;
            opt.textContent = rec;
            dropdown.appendChild(opt);
        });
        
        dropdown.onchange = (e) => {
            selectedRecipient = e.target.value;
        };
    }
}

function selectRecipient(recipient, button) {
    selectedRecipient = recipient;
    document.querySelectorAll('.recipients-buttons button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (button) button.classList.add('active');
}

function setupMoodTags() {
    const moodButtons = document.querySelectorAll('.mood-tag');
    moodButtons.forEach(btn => {
        btn.onclick = () => {
            selectedMood = btn.dataset.mood;
            moodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
}

function setupDeliveryTime() {
    const deliverySelect = document.getElementById('deliveryTime');
    const customInput = document.getElementById('customDelivery');
    
    deliverySelect.onchange = () => {
        if (deliverySelect.value === 'custom') {
            customInput.style.display = 'block';
        } else {
            customInput.style.display = 'none';
        }
    };
}

function calculateDeliveryTime() {
    const deliveryOption = document.getElementById('deliveryTime').value;
    const now = new Date();
    
    switch(deliveryOption) {
        case 'now':
            return now.toISOString();
        case 'tonight':
            const tonight = new Date(now);
            tonight.setHours(20, 0, 0, 0);
            if (tonight < now) tonight.setDate(tonight.getDate() + 1);
            return tonight.toISOString();
        case 'tomorrow':
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString();
        case 'custom':
            const customTime = document.getElementById('customDelivery').value;
            return customTime ? new Date(customTime).toISOString() : now.toISOString();
        default:
            return now.toISOString();
    }
}

async function sendLetter() {
    if (!selectedRecipient) {
        alert('Selecteaza un destinatar!');
        return;
    }
    
    const message = document.getElementById('messageText').value.trim();
    if (!message) {
        alert('Scrie un mesaj!');
        return;
    }
    
    const photoFiles = document.getElementById('photoInput').files;
    const photoURLs = [];
    
    for (let file of photoFiles) {
        const storageRef = ref(storage, `photos/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        photoURLs.push(url);
    }
    
    const letter = {
        from: currentUser,
        to: selectedRecipient,
        message: message,
        mood: selectedMood,
        photos: photoURLs,
        date: serverTimestamp(),
        deliveryTime: calculateDeliveryTime(),
        read: false,
        readAt: null
    };
    
    await addDoc(collection(db, "letters"), letter);
    
    document.getElementById('messageText').value = '';
    document.getElementById('photoInput').value = '';
    document.getElementById('photoPreview').innerHTML = '';
    selectedRecipient = null;
    selectedMood = null;
    
    document.querySelectorAll('.recipients-buttons button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.mood-tag').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById('deliveryTime').value = 'now';
    document.getElementById('customDelivery').style.display = 'none';
    
    alert('Scrisoare trimisa!');
    await loadLettersFromFirebase();
    renderInbox();
    renderArchive();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

document.getElementById('photoInput')?.addEventListener('change', function(e) {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '';
    
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = document.createElement('img');
            img.src = event.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
});

function renderInbox() {
    const container = document.getElementById('inboxList');
    const now = new Date();
    
    const userLetters = letters.filter(l => 
        l.to === currentUser && 
        new Date(l.deliveryTime) <= now
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (userLetters.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Nicio scrisoare in inbox...</p></div>`;
        return;
    }
    
    container.innerHTML = '';
    userLetters.forEach(letter => {
        const div = document.createElement('div');
        div.className = `envelope ${letter.read ? 'read' : 'unread'}`;
        
        const preview = letter.message.length > 80 ? letter.message.substring(0, 80) + '...' : letter.message;
        
        div.innerHTML = `
            ${!letter.read ? '<div class="unread-badge"></div>' : ''}
            <h3>De la: ${letter.from}</h3>
            <p>${preview}</p>
            ${letter.mood ? `<span class="mood-badge">${getMoodEmoji(letter.mood)} ${capitalizeFirst(letter.mood)}</span>` : ''}
            <div class="date">${formatDate(letter.date)}</div>
        `;
        
        div.onclick = () => openLetter(letter);
        container.appendChild(div);
    });
}

function renderArchive() {
    const container = document.getElementById('archiveList');
    const now = new Date();
    
    const userLetters = letters.filter(l => 
        (l.from === currentUser || l.to === currentUser) &&
        new Date(l.deliveryTime) <= now
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (userLetters.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Arhiva este goala...</p></div>`;
        return;
    }
    
    const grouped = {};
    userLetters.forEach(letter => {
        const date = new Date(letter.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' });
        
        if (!grouped[monthKey]) {
            grouped[monthKey] = { name: capitalizeFirst(monthName), letters: [] };
        }
        grouped[monthKey].letters.push(letter);
    });
    
    container.innerHTML = '';
    Object.keys(grouped).sort().reverse().forEach(monthKey => {
        const month = grouped[monthKey];
        const monthDiv = document.createElement('div');
        monthDiv.className = 'archive-month';
        
        let monthHTML = `<h3>${month.name}</h3>`;
        
        month.letters.forEach(letter => {
            const isReceived = letter.to === currentUser;
            const preview = letter.message.length > 100 ? letter.message.substring(0, 100) + '...' : letter.message;
            
            monthHTML += `
                <div class="archive-letter" onclick='openLetterFromJSON(${JSON.stringify(letter).replace(/'/g, "&#39;")})'>
                    <div class="letter-header">
                        <span class="letter-type">${isReceived ? '📨 Primita' : '📤 Trimisa'}</span>
                        <span class="date">${formatDate(letter.date)}</span>
                    </div>
                    <h4>${isReceived ? `De la: ${letter.from}` : `Catre: ${letter.to}`}</h4>
                    <p>${preview}</p>
                    ${letter.mood ? `<span class="mood-badge">${getMoodEmoji(letter.mood)} ${capitalizeFirst(letter.mood)}</span>` : ''}
                </div>
            `;
        });
        
        monthDiv.innerHTML = monthHTML;
        container.appendChild(monthDiv);
    });
}

function openLetterFromJSON(letter) {
    openLetter(letter);
}

async function openLetter(letter) {
    if (letter.to === currentUser && !letter.read) {
        const letterDoc = doc(db, "letters", letter.id);
        await updateDoc(letterDoc, {
            read: true,
            readAt: serverTimestamp()
        });
        
        await loadLettersFromFirebase();
        renderInbox();
        renderArchive();
    }
    
    const modal = document.getElementById('letterModal');
    const content = document.getElementById('letterContent');
    
    let photosHTML = '';
    if (letter.photos && letter.photos.length > 0) {
        photosHTML = `
            <div class="polaroid-gallery">
                ${letter.photos.map(photo => `
                    <div class="polaroid">
                        <img src="${photo}" alt="Photo">
                        <div class="polaroid-caption">${formatDate(letter.date)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    const isReceived = letter.to === currentUser;
    let readReceiptHTML = '';
    if (!isReceived && letter.read && letter.readAt) {
        readReceiptHTML = `<div class="read-receipt">✓ Citita la ${formatDateTime(letter.readAt)}</div>`;
    }
    
    content.innerHTML = `
        <div class="letter-full">
            <div class="letter-date">${formatDate(letter.date)}</div>
            <h3>${isReceived ? `De la: ${letter.from}` : `Catre: ${letter.to}`}</h3>
            ${letter.mood ? `<span class="mood-badge">${getMoodEmoji(letter.mood)} ${capitalizeFirst(letter.mood)}</span>` : ''}
            <div class="message">${letter.message}</div>
            ${photosHTML}
            ${readReceiptHTML}
        </div>
    `;
    
    modal.classList.add('active');
}

function closeLetterModal() {
    document.getElementById('letterModal').classList.remove('active');
}

window.onclick = function(event) {
    const modal = document.getElementById('letterModal');
    if (event.target === modal) closeLetterModal();
}

async function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page + 'Screen').classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    await loadLettersFromFirebase();
    if (page === 'inbox') renderInbox();
    if (page === 'archive') renderArchive();
}
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getMoodEmoji(mood) {
    const emojis = {
        'fericit': '😊', 'ganditor': '💭', 'trist': '😔',
        'iubitor': '❤️', 'nostalgic': '🌙', 'motivat': '⚡',
        'calm': '🌸', 'entuziast': '🎉'
    };
    return emojis[mood] || '💌';
}

window.login = login;
window.showPage = showPage;
window.sendLetter = sendLetter;
async function showAddFriendPrompt() {
    const friendUsername = prompt('Introdu username-ul prietenului:');
    if (!friendUsername) return;
    
    try {
        const friendQuery = query(collection(db, "users"), where("username", "==", friendUsername));
        const friendSnapshot = await getDocs(friendQuery);
        
        if (friendSnapshot.empty) {
            alert('User-ul nu exista!');
            return;
        }
        
        const userQuery = query(collection(db, "users"), where("username", "==", currentUser));
        const userSnapshot = await getDocs(userQuery);
        const userDoc = userSnapshot.docs[0];
        const currentFriends = userDoc.data().friends || [];
        
        if (currentFriends.includes(friendUsername)) {
            alert('Prietenul este deja adaugat!');
            return;
        }
        
        await updateDoc(doc(db, "users", userDoc.id), {
            friends: [...currentFriends, friendUsername]
        });
        
        alert(`${friendUsername} adaugat la prieteni!`);
        setupRecipients();
    } catch (error) {
        console.error('Add friend error:', error);
        alert('Eroare la adaugare prieten!');
    }
}

window.showAddFriendPrompt = showAddFriendPrompt;