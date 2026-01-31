
        // API Configuration
        const API_BASE = 'https://api.alquran.cloud/v1';
        const ARABIC_EDITION = 'quran-uthmani'; // Teks Arab murni
        
        let currentSurah = 1;
        let allSurahs = [];
        let darkMode = false;
        let isSurahView = false;

        // DOM Elements
        const surahListView = document.getElementById('surahListView');
        const quranDisplayView = document.getElementById('quranDisplayView');
        const surahList = document.getElementById('surahList');
        const surahTitle = document.getElementById('surahTitle');
        const surahSubtitle = document.getElementById('surahSubtitle');
        const bismillah = document.getElementById('bismillah');
        const versesContainer = document.getElementById('versesContainer');
        const searchInput = document.getElementById('searchInput');
        const backToListBtn = document.getElementById('backToList');
        const themeToggle = document.getElementById('themeToggle');
        const prevSurahBtn = document.getElementById('prevSurah');
        const nextSurahBtn = document.getElementById('nextSurah');

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            loadSurahList();
            setupEventListeners();
            
            // Load theme preference
            const savedTheme = localStorage.getItem('quranDarkMode');
            if (savedTheme === 'true') {
                toggleDarkMode();
            }
        });

        // Event Listeners
        function setupEventListeners() {
            themeToggle.addEventListener('click', toggleDarkMode);
            searchInput.addEventListener('input', filterSurahs);
            backToListBtn.addEventListener('click', showSurahList);
            prevSurahBtn.addEventListener('click', loadPreviousSurah);
            nextSurahBtn.addEventListener('click', loadNextSurah);
            
            // Keyboard shortcuts
            document.addEventListener('keydown', function(e) {
                // ESC to go back to list
                if (e.key === 'Escape' && isSurahView) {
                    showSurahList();
                }
                
                // Left/Right arrow for navigation
                if (isSurahView) {
                    if (e.key === 'ArrowRight' && currentSurah > 1) {
                        loadPreviousSurah();
                    } else if (e.key === 'ArrowLeft' && currentSurah < 114) {
                        loadNextSurah();
                    }
                }
                
                // Ctrl+F for search
                if (e.ctrlKey && e.key === 'f') {
                    e.preventDefault();
                    searchInput.focus();
                }
            });
        }

        // Load Surah List
        async function loadSurahList() {
            try {
                const response = await fetch(`${API_BASE}/surah`);
                const data = await response.json();
                
                if (data.code === 200) {
                    allSurahs = data.data;
                    renderSurahList(allSurahs);
                } else {
                    throw new Error('Failed to load surah list');
                }
            } catch (error) {
                surahList.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>تعذر تحميل قائمة السور. يرجى المحاولة مرة أخرى.</p>
                        <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 25px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Amiri', serif;">
                            <i class="fas fa-redo"></i> إعادة التحميل
                        </button>
                    </div>
                `;
                console.error('Error loading surah list:', error);
            }
        }

        // Render Surah List
        function renderSurahList(surahs) {
            surahList.innerHTML = '';
            
            if (surahs.length === 0) {
                surahList.innerHTML = `
                    <div class="error" style="grid-column: 1/-1;">
                        <i class="fas fa-search"></i>
                        <p>لم يتم العثور على سورة تطابق البحث.</p>
                    </div>
                `;
                return;
            }
            
            surahs.forEach(surah => {
                const li = document.createElement('li');
                li.className = 'surah-item';
                li.dataset.id = surah.number;
                
                li.innerHTML = `
                    <div class="surah-number">${surah.number}</div>
                    <div class="surah-content">
                        <div class="surah-name-arabic">${surah.name}</div>
                        <div class="surah-name-english">
                            <i class="fas fa-globe"></i>
                            ${surah.englishName} (${surah.englishNameTranslation})
                        </div>
                        <div class="surah-details">
                            <span><i class="fas fa-ayat"></i> ${surah.numberOfAyahs} آية</span>
                            <span><i class="fas fa-clock"></i> ${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
                        </div>
                    </div>
                `;
                
                li.addEventListener('click', () => {
                    currentSurah = surah.number;
                    showSurahView();
                    loadSurah(currentSurah);
                });
                
                surahList.appendChild(li);
            });
        }

        // Show Surah View
        function showSurahView() {
            isSurahView = true;
            surahListView.classList.remove('active');
            quranDisplayView.classList.add('active');
            backToListBtn.style.display = 'flex';
            searchInput.placeholder = "ابحث في آيات السورة الحالية...";
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Show Surah List
        function showSurahList() {
            isSurahView = false;
            surahListView.classList.add('active');
            quranDisplayView.classList.remove('active');
            backToListBtn.style.display = 'none';
            searchInput.placeholder = "ابحث عن سورة بالاسم أو الرقم...";
            searchInput.value = '';
            renderSurahList(allSurahs);
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Load Surah (Arabic only)
        async function loadSurah(surahNumber) {
            try {
                versesContainer.innerHTML = `
                    <div class="loading">
                        <i class="fas fa-book-open"></i>
                        <p>جاري تحميل آيات السورة...</p>
                    </div>
                `;
                
                // Fetch surah data - HANYA teks Arab
                const response = await fetch(`${API_BASE}/surah/${surahNumber}/${ARABIC_EDITION}`);
                const data = await response.json();
                
                if (data.code !== 200) {
                    throw new Error('Data tidak ditemukan');
                }
                
                const surah = allSurahs.find(s => s.number == surahNumber) || data.data;
                const arabicAyahs = data.data.ayahs;
                
                // Update header
                surahTitle.textContent = surah.name;
                surahSubtitle.innerHTML = `
                    <span><i class="fas fa-hashtag"></i> السورة ${surah.number}</span>
                    <span><i class="fas fa-ayat"></i> ${surah.numberOfAyahs} آيات</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
                `;
                
                // Show/hide bismillah
                if (surahNumber !== 1 && surahNumber !== 9) {
                    bismillah.style.display = 'block';
                } else {
                    bismillah.style.display = 'none';
                }
                
                // Update navigation buttons
                updateNavigationButtons(surahNumber);
                
                // Render verses (Arabic only)
                renderVerses(arabicAyahs);
                
            } catch (error) {
                versesContainer.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>تعذر تحميل السورة. يرجى المحاولة مرة أخرى.</p>
                        <button onclick="loadSurah(${surahNumber})" style="margin-top: 20px; padding: 12px 25px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Amiri', serif;">
                            <i class="fas fa-redo"></i> محاولة مرة أخرى
                        </button>
                    </div>
                `;
                console.error('Error loading surah:', error);
            }
        }

        // Update Navigation Buttons
        function updateNavigationButtons(surahNumber) {
            prevSurahBtn.disabled = surahNumber <= 1;
            nextSurahBtn.disabled = surahNumber >= 114;
            
            prevSurahBtn.style.opacity = surahNumber <= 1 ? '0.5' : '1';
            nextSurahBtn.style.opacity = surahNumber >= 114 ? '0.5' : '1';
            
            // Update tooltips
            if (surahNumber > 1) {
                const prevSurah = allSurahs.find(s => s.number == surahNumber - 1);
                prevSurahBtn.title = `الذهاب إلى سورة ${prevSurah?.name || 'السابقة'}`;
            }
            
            if (surahNumber < 114) {
                const nextSurah = allSurahs.find(s => s.number == surahNumber + 1);
                nextSurahBtn.title = `الذهاب إلى سورة ${nextSurah?.name || 'التالية'}`;
            }
        }

        // Load Previous Surah
        function loadPreviousSurah() {
            if (currentSurah > 1) {
                currentSurah--;
                loadSurah(currentSurah);
            }
        }

        // Load Next Surah
        function loadNextSurah() {
            if (currentSurah < 114) {
                currentSurah++;
                loadSurah(currentSurah);
            }
        }

          // Render Verses (Arabic only)
        function renderVerses(arabicAyahs) {
            versesContainer.innerHTML = '';
            
            arabicAyahs.forEach((ayah, index) => {
                const verseDiv = document.createElement('div');
                verseDiv.className = 'verse-item';
                verseDiv.dataset.ayah = ayah.numberInSurah;
                verseDiv.dataset.juz = ayah.juz;
                verseDiv.dataset.page = ayah.page;
                
                verseDiv.innerHTML = `
                    <div class="verse-text">
                        <span class="verse-number">${ayah.numberInSurah}</span>
                        ${ayah.text}
                    </div>
                    <div class="verse-info">
                        <div class="verse-meta">
                            <span><i class="fas fa-bookmark"></i> الجزء ${ayah.juz}</span>
                            <span style="margin-right: 20px;"><i class="fas fa-file"></i> الصفحة ${ayah.page}</span>
                        </div>
                        <div class="verse-actions">
                            <button class="verse-action-btn" title="تكبير الخط" onclick="increaseFontSize(this)">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="verse-action-btn" title="نسخ الآية" onclick="copyVerse(${ayah.numberInSurah}, '${ayah.text.replace(/'/g, "\\'")}')">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="verse-action-btn" title="الاستماع للآية" onclick="playVerse(${ayah.numberInSurah})">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                versesContainer.appendChild(verseDiv);
            });
            
            // Add page styling
            addPageStyling();
        }

        // Add page styling based on page numbers
        function addPageStyling() {
            const verses = document.querySelectorAll('.verse-item');
            let currentPage = null;
            let pageStartIndex = 0;
            
            verses.forEach((verse, index) => {
                const page = parseInt(verse.dataset.page);
                
                if (currentPage === null) {
                    currentPage = page;
                    pageStartIndex = index;
                }
                
                if (page !== currentPage || index === verses.length - 1) {
                    // Create page container for previous page
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'mushaf-page';
                    
                    const pageNumber = document.createElement('div');
                    pageNumber.className = 'page-number';
                    pageNumber.textContent = `ص ${currentPage}`;
                    
                    // Get verses for this page
                    const pageVerses = Array.from(verses).slice(pageStartIndex, index);
                    pageVerses.forEach(v => {
                        pageDiv.appendChild(v.cloneNode(true));
                    });
                    
                    pageDiv.appendChild(pageNumber);
                    
                    // Replace original verses with page container
                    const firstVerse = verses[pageStartIndex];
                    firstVerse.parentNode.insertBefore(pageDiv, firstVerse);
                    
                    // Remove original verses
                    pageVerses.forEach(v => v.remove());
                    
                    // Update for next page
                    currentPage = page;
                    pageStartIndex = index;
                }
            });
        }

        // Filter Surahs
        function filterSurahs() {
            const searchTerm = searchInput.value.trim();
            
            if (!isSurahView) {
                // Search in surah list (Arabic names)
                const filtered = allSurahs.filter(surah => 
                    surah.name.includes(searchTerm) ||
                    surah.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    surah.number.toString().includes(searchTerm)
                );
                renderSurahList(filtered);
            } else {
                // Search in current surah
                searchInCurrentSurah(searchTerm);
            }
        }

        // Search in Current Surah
        function searchInCurrentSurah(searchTerm) {
            if (!searchTerm) {
                // Reset search
                const verses = document.querySelectorAll('.verse-item');
                verses.forEach(verse => {
                    verse.style.display = 'block';
                    verse.style.backgroundColor = '';
                });
                return;
            }
            
            const verses = document.querySelectorAll('.verse-item');
            let found = false;
            
            verses.forEach(verse => {
                const arabicText = verse.querySelector('.verse-text').textContent;
                
                if (arabicText.includes(searchTerm)) {
                    verse.style.display = 'block';
                    verse.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
                    verse.style.borderLeft = '4px solid var(--gold)';
                    found = true;
                    
                    // Scroll to first found verse
                    if (!found) {
                        verse.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } else {
                    verse.style.display = 'none';
                }
            });
            
            if (!found && searchTerm) {
                versesContainer.innerHTML += `
                    <div class="error" style="margin-top: 20px;">
                        <i class="fas fa-search"></i>
                        <p>لم يتم العثور على "${searchTerm}" في هذه السورة.</p>
                    </div>
                `;
            }
        }

        // Toggle Dark Mode
        function toggleDarkMode() {
            darkMode = !darkMode;
            document.body.classList.toggle('dark-mode', darkMode);
            
            // Update icon
            const icon = themeToggle.querySelector('i');
            icon.className = darkMode ? 'fas fa-sun' : 'fas fa-moon';
            themeToggle.title = darkMode ? 'الوضع المضيء' : 'الوضع المظلم';
            
            // Save preference
            localStorage.setItem('quranDarkMode', darkMode);
        }

        // Utility functions for verse actions
        function increaseFontSize(button) {
            const verseText = button.closest('.verse-item').querySelector('.verse-text');
            const currentSize = parseFloat(window.getComputedStyle(verseText).fontSize);
            verseText.style.fontSize = (currentSize + 2) + 'px';
        }

        function copyVerse(verseNumber, text) {
            const arabicText = text;
            navigator.clipboard.writeText(arabicText).then(() => {
                // Show temporary notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--primary);
                    color: white;
                    padding: 12px 25px;
                    border-radius: 8px;
                    z-index: 1000;
                    font-family: 'Amiri', serif;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                `;
                notification.innerHTML = `<i class="fas fa-check"></i> تم نسخ الآية ${verseNumber}`;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.remove();
                }, 2000);
            });
        }

        function playVerse(verseNumber) {
            // Audio functionality can be added here
            alert(`سيتم إضافة وظيفة الاستماع للآية ${verseNumber} في التحديثات القادمة بإذن الله`);
        }

        // Auto-hide search when scrolling in surah view
        let lastScrollTop = 0;
        window.addEventListener('scroll', function() {
            if (!isSurahView) return;
            
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling down
                searchInput.style.opacity = '0.5';
            } else {
                // Scrolling up
                searchInput.style.opacity = '1';
            }
            
            lastScrollTop = scrollTop;
        });
    