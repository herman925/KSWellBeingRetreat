        let currentData = [];
let currentExportSection = '';
let currentExportButton = null;

function showExportMenu(section, button) {
    const exportMenu = document.getElementById('exportMenu');
    const rect = button.getBoundingClientRect();
    
    // Hide any other active export menus
    hideExportMenu();
    
    currentExportSection = section;
    currentExportButton = button;
    
    // Show/hide shuttle export option based on section
    const shuttleExportOption = document.getElementById('shuttleExportOption');
    shuttleExportOption.style.display = section === 'transport' ? 'flex' : 'none';
    
    exportMenu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    exportMenu.style.left = `${rect.left}px`;
    exportMenu.classList.add('active');
    
    document.addEventListener('click', handleExportMenuClick);
}

function hideExportMenu() {
    const exportMenu = document.getElementById('exportMenu');
    exportMenu.classList.remove('active');
    document.removeEventListener('click', handleExportMenuClick);
}

function handleExportMenuClick(e) {
    const exportMenu = document.getElementById('exportMenu');
    if (!exportMenu.contains(e.target) && e.target !== currentExportButton) {
        hideExportMenu();
    }
}

function exportData(format) {
    hideExportMenu();
    
    let data = [];
    let filename = '';
    
    switch (currentExportSection) {
        case 'registration':
            data = currentData.map(p => ({
                'Registration Time': p['Timestamp'],
                'Name': p['參加者中文全名'],
                'School': p['參加者所屬學校'],
                'Phone': p['參加者手提電話'],
                'Pick-up Point': p['去程集合點 (箭咀位置附近停車。實際停車位置視乎路況。)'],
                'Drop-off Point': p['回程解散點 (箭咀位置附近停車。實際停車位置視乎路況。)'],
                'Meal Letter': mealLetterMap[p['午餐']] || '',
                'Lunch Choice': p['午餐']
            }));
            filename = 'registration_list';
            break;
            
        case 'meals':
            const mealCounts = {};
            const mealParticipants = {};
            currentData.forEach(p => {
                const meal = p['午餐'];
                mealCounts[meal] = (mealCounts[meal] || 0) + 1;
                if (!mealParticipants[meal]) mealParticipants[meal] = [];
                mealParticipants[meal].push(p['參加者中文全名']);
            });
            
            data = Object.entries(mealParticipants)
                .sort((a, b) => (mealLetterMap[a[0]] || '').localeCompare(mealLetterMap[b[0]] || ''))
                .map(([meal, names]) => ({
                    'Meal Letter': mealLetterMap[meal] || '',
                    'Meal Type': meal,
                    'Count': mealCounts[meal],
                    'Participants': names.join(', ')
                }));
            filename = 'meal_preferences';
            break;
            
        case 'transport':
            const transportData = {pickup: {}, dropoff: {}};
            currentData.forEach(p => {
                const pickup = p['去程集合點 (箭咀位置附近停車。實際停車位置視乎路況。)'];
                const dropoff = p['回程解散點 (箭咀位置附近停車。實際停車位置視乎路況。)'];
                
                if (!transportData.pickup[pickup]) transportData.pickup[pickup] = [];
                if (!transportData.dropoff[dropoff]) transportData.dropoff[dropoff] = [];
                
                transportData.pickup[pickup].push(p['參加者中文全名']);
                transportData.dropoff[dropoff].push(p['參加者中文全名']);
            });
            
            data = [
                ...Object.entries(transportData.pickup).map(([location, names]) => ({
                    'Type': 'Pick-up',
                    'Location': location,
                    'Count': names.length,
                    'Participants': names.join(', ')
                })),
                ...Object.entries(transportData.dropoff).map(([location, names]) => ({
                    'Type': 'Drop-off',
                    'Location': location,
                    'Count': names.length,
                    'Participants': names.join(', ')
                }))
            ];
            filename = 'transport_summary';
            break;
    }
    
    if (format === 'xlsx') {
        exportToExcel(data, filename);
    } else {
        exportToCSV(data, filename);
    }
}

function exportToExcel(data, filename) {
    try {
        const ws = XLSX.utils.json_to_sheet(data, {
            skipHeader: false,
            origin: 'A1'
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');

        XLSX.writeFile(wb, `${filename}_${getFormattedDate()}.xlsx`);
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Failed to export Excel file. Please try again.');
    }
}

function exportToCSV(data, filename) {
    try {
        if (data.length === 0) {
            alert('No data to export');
            return;
        }

        const headers = Object.keys(data[0]);
        const bom = '\uFEFF';
        
        const csvContent = bom + headers.join(',') + '\n' + 
            data.map(row => 
                headers.map(field => {
                    let value = row[field] || '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                }).join(',')
            ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${getFormattedDate()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting to CSV:', error);
        alert('Failed to export CSV file. Please try again.');
    }
}

function getFormattedDate() {
    const date = new Date();
    return date.toISOString().split('T')[0];
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadRoles();
    loadParticipantData();
});

// Load roles for the selector
async function loadRoles() {
    const roleSelect = document.getElementById('roleSelect');
    try {
        const response = await fetch('../data/roles.json');
        const data = await response.json();
        
        roleSelect.innerHTML = '<option value="">Select Your Role</option>';
        
        data.roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = `${role.name}${role.title ? ` (${role.title})` : ''}`;
            roleSelect.appendChild(option);
        });
        
        const savedRole = localStorage.getItem('selectedRole');
        if (savedRole) {
            roleSelect.value = savedRole;
        }
    } catch (error) {
        console.error('Error loading roles:', error);
    }

    roleSelect.addEventListener('change', function() {
        const selectedRole = this.value;
        localStorage.setItem('selectedRole', selectedRole);
    });
}

// Load and process participant data
async function loadParticipantData() {
    try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vR13cBu2nSz3Aj6QTXaTy6M4yz8nrZ0NWRkfcxABlUUDJ0L-zZUKY9qS1at7mvw4joyh2ihFndmTz2V/pub?gid=1115087104&single=true&output=csv', {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        
        currentData = parseCSV(csvText);
        
        renderParticipantTable(currentData);
        updateStatistics(currentData);
        renderMealSummary(currentData);
        renderTransportSummary(currentData);
    } catch (error) {
        console.error('Error loading participant data:', error);
        showNotification('Failed to load participant data', 'error');
    }
}

// Parse CSV data
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index].trim();
            });
            data.push(row);
        }
    }

    return data;
}

// Render participant table
function renderParticipantTable(data) {
    const tbody = document.getElementById('participantTableBody');
    tbody.innerHTML = '';

    data.forEach(participant => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${participant['Timestamp']}</td>
            <td>${participant['參加者中文全名']}</td>
            <td>${participant['參加者所屬學校']}</td>
            <td>${participant['參加者手提電話']}</td>
            <td>${participant['去程集合點 (箭咀位置附近停車。實際停車位置視乎路況。)']}</td>
            <td>${participant['回程解散點 (箭咀位置附近停車。實際停車位置視乎路況。)']}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Meal letter mapping
const mealLetterMap = {
    '蕃茄牛面脥肉醬長通粉': 'A',
    '香煎豬柳配蘑茹伴薯角': 'B',
    '香烤魚柳伴忌廉蔬菜螺絲粉': 'C',
    '青醬蘑茹長通粉': 'D'
};

// Meal icon mapping
const mealIconMap = {
    'A': '<i class="fas fa-drumstick-bite"></i>',  // Beef
    'B': '<i class="fas fa-piggy-bank"></i>',  // Pork
    'C': '<i class="fas fa-fish"></i>',  // Fish
    'D': '<i class="fas fa-seedling"></i>'  // Mushroom
};

// Render meal summary
function renderMealSummary(data) {
    const mealCounts = {};
    const mealParticipants = {};
    
    data.forEach(participant => {
        const meal = participant['午餐'];
        mealCounts[meal] = (mealCounts[meal] || 0) + 1;
        
        if (!mealParticipants[meal]) {
            mealParticipants[meal] = [];
        }
        mealParticipants[meal].push(participant['參加者中文全名']);
    });

    const summaryContainer = document.getElementById('mealSummary');
    summaryContainer.innerHTML = '';
    
    // Sort meals by their letter
    const sortedMeals = Object.entries(mealCounts).sort((a, b) => {
        const letterA = mealLetterMap[a[0]] || '';
        const letterB = mealLetterMap[b[0]] || '';
        return letterA.localeCompare(letterB);
    });
    
    sortedMeals.forEach(([meal, count]) => {
        const letter = mealLetterMap[meal] || '';
        const icon = mealIconMap[letter] || '';
        const card = document.createElement('div');
        card.className = 'summary-card';
        card.onclick = () => showPopup(`Meal ${letter}: ${meal}`, mealParticipants[meal]);
        card.innerHTML = `
            <h3 class="meal-letter">${icon} Meal ${letter}</h3>
            <div class="meal-name">${meal}</div>
            <div class="value">${count}</div>
        `;
        summaryContainer.appendChild(card);
    });
}

// Render transport summary
function renderTransportSummary(data) {
    const pickupPoints = {};
    const dropoffPoints = {};
    const pickupParticipants = {};
    const dropoffParticipants = {};

    data.forEach(participant => {
        const pickup = participant['去程集合點 (箭咀位置附近停車。實際停車位置視乎路況。)'];
        const dropoff = participant['回程解散點 (箭咀位置附近停車。實際停車位置視乎路況。)'];
        const name = participant['參加者中文全名'];
        // Handle pickup points
        pickupPoints[pickup] = (pickupPoints[pickup] || 0) + 1;
        if (!pickupParticipants[pickup]) {
            pickupParticipants[pickup] = [];
        }
        pickupParticipants[pickup].push(name);

        // Handle dropoff points
        dropoffPoints[dropoff] = (dropoffPoints[dropoff] || 0) + 1;
        if (!dropoffParticipants[dropoff]) {
            dropoffParticipants[dropoff] = [];
        }
        dropoffParticipants[dropoff].push(name);
    });

    renderTransportList('pickupList', pickupPoints, pickupParticipants, 'Pick-up');
    renderTransportList('dropoffList', dropoffPoints, dropoffParticipants, 'Drop-off');
}

function renderTransportList(elementId, points, participants, type) {
    const list = document.getElementById(elementId);
    list.innerHTML = '';

    Object.entries(points)
        .sort((a, b) => b[1] - a[1])
        .forEach(([location, count]) => {
            const li = document.createElement('li');
            li.onclick = () => showPopup(`${type} Point: ${location}`, participants[location]);
            li.innerHTML = `
                <span class="transport-location">${location}</span>
                <span class="transport-count">${count}</span>
            `;
            list.appendChild(li);
        });
}

// Popup functions
function showPopup(title, names) {
    const popupOverlay = document.getElementById('popupOverlay');
    const popupTitle = document.getElementById('popupTitle');
    const popupList = document.getElementById('popupList');

    popupTitle.textContent = title;
    popupList.innerHTML = names.map(name => `<li class="name-tag">${name}</li>`).join('');
    
    popupOverlay.classList.add('active');
}

function closePopup() {
    const popupOverlay = document.getElementById('popupOverlay');
    popupOverlay.classList.remove('active');
}

// Close popup when clicking outside
document.getElementById('popupOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('popupOverlay')) {
        closePopup();
    }
});

// Close popup with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePopup();
    }
});

function exportShuttleAttendance() {
    hideExportMenu();
    
    try {
        // Group participants by pickup location
        const pickupLocations = {};
        
        currentData.forEach(p => {
            const pickup = p['去程集合點 (箭咀位置附近停車。實際停車位置視乎路況。)'];
            if (!pickupLocations[pickup]) {
                pickupLocations[pickup] = [];
            }
            pickupLocations[pickup].push({
                name: p['參加者中文全名'],
                school: p['參加者所屬學校'],
                contact: p['參加者手提電話']
            });
        });

        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Create a sheet for each pickup location
        Object.entries(pickupLocations).forEach(([location, participants]) => {
            // Create header rows
            const wsData = [
                ['Shuttle Bus Attendance Sheet'],
                [`Pick-up Point: ${location}`],
                [''],
                ['Name', 'School', 'Contact', 'Signature']
            ];
            
            // Add participant rows
            participants.forEach(p => {
                wsData.push([p.name, p.school, p.contact, '']);
            });
            
            // Create worksheet
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // Set column widths
            ws['!cols'] = [
                { wch: 25 }, // Name
                { wch: 35 }, // School
                { wch: 15 }, // Contact
                { wch: 20 }  // Signature
            ];
            
            // Clean sheet name
            const safeLocation = location
                .replace(/[\\\/\[\]\:\*\?]/g, ' ') // Replace invalid chars with space
                .replace(/\s+/g, ' ')              // Replace multiple spaces with single space
                .trim()                            // Remove leading/trailing spaces
                .substring(0, 31);                 // Excel sheet name length limit
            
            XLSX.utils.book_append_sheet(wb, ws, safeLocation);
        });
        
        // Save the workbook
        XLSX.writeFile(wb, `shuttle_attendance_${getFormattedDate()}.xlsx`);
        
        // Show success message
        showPopup('Export Successful', ['Shuttle attendance sheets have been exported.']);
        
    } catch (error) {
        console.error('Error exporting shuttle attendance:', error);
        showPopup('Export Failed', ['Failed to export shuttle attendance sheets.', 'Please try again.']);
    }
}

// Add notification function if not already present
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateStatistics(data) {
    // Update total registrations
    const totalRegistrations = data.length;
    document.getElementById('totalRegistrations').textContent = totalRegistrations;

    // Calculate total teachers (excluding EdUHK and TLG staff)
    const totalTeachers = data.filter(participant => {
        const school = participant['參加者所屬學校'];
        return !school.includes('香港教育大學') && 
               !school.includes('教育大學') && 
               !school.includes('童亮館');
    }).length;
    document.getElementById('totalTeachers').textContent = totalTeachers;

    // Calculate school breakdown
    const schoolCounts = {};
    data.forEach(participant => {
        const school = participant['參加者所屬學校'];
        schoolCounts[school] = (schoolCounts[school] || 0) + 1;
    });

    // Sort schools with special handling for EdUHK and TLG
    const sortedSchools = Object.entries(schoolCounts)
        .sort(([schoolA, countA], [schoolB, countB]) => {
            // Check if either school is EdUHK or TLG
            const isSpecialA = schoolA.includes('香港教育大學') || 
                             schoolA.includes('教育大學') || 
                             schoolA.includes('童亮館');
            const isSpecialB = schoolB.includes('香港教育大學') || 
                             schoolB.includes('教育大學') || 
                             schoolB.includes('童亮館');

            // If one is special and the other isn't, special one goes first
            if (isSpecialA && !isSpecialB) return -1;
            if (!isSpecialA && isSpecialB) return 1;

            // If both are special or both are not special, sort by count
            return countB - countA;
        });

    // Update school breakdown table
    const tbody = document.getElementById('schoolBreakdownBody');
    tbody.innerHTML = '';

    sortedSchools.forEach(([school, count]) => {
        const tr = document.createElement('tr');
        // Add special styling for EdUHK and TLG
        const isSpecial = school.includes('香港教育大學') || 
                         school.includes('教育大學') || 
                         school.includes('童亮館');
        if (isSpecial) {
            tr.classList.add('highlighted-row');
        }
        tr.innerHTML = `
            <td>${school}</td>
            <td>${count}</td>
        `;
        tbody.appendChild(tr);
    });
}