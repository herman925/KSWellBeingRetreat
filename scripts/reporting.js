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

// Export functions
async function exportParticipants(format) {
    try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQPxa_um6ooJ5f_H_kQQVcAuyGc-TgSmN1BeT019G-gcGwEQUWztwRHu_Xc_W1LRkj9AZIa-fvplTQm/pub?gid=2081403343&single=true&output=csv');
        const text = await response.text();
        const data = parseCSV(text);

        // Enrich data with relevant fields for better reporting
        const enrichedData = data.map(p => ({
            ...p,
            'Name': p['參加者中文全名'] || '',
            'School': p['參加者所屬學校'] || '',
            'Group': p['Group'] || '',
            'Contact': p['參加者手提電話'] || '',
            'Pickup Point': p['去程集合點 (箭咀位置附近停車。實際停車位置視乎路況。)'] || '',
            'Dropoff Point': p['回程解散點 (箭咀位置附近停車。實際停車位置視乎路況。)'] || '',
            'Meal Preferences': p['Meal Preferences'] || '',
            'Pretest Status': p['Pretest Status'] || '',
            'Attended Workshop': p['Attended Workshop'] || '',
            'Round Attended': p['Round Attended'] || '',
            'Remarks': p['Remark'] || ''
        }));

        // Sort by timestamp in reverse chronological order
        enrichedData.sort((a, b) => {
            const timeA = new Date(a['Timestamp']);
            const timeB = new Date(b['Timestamp']);
            return timeB - timeA; // Reverse chronological order
        });

        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(enrichedData);
            XLSX.utils.book_append_sheet(wb, ws, 'Participants');
            XLSX.writeFile(wb, `participants_${getFormattedDate()}.xlsx`);
        } else {
            exportToCSV(enrichedData, 'participants');
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed. Please try again.');
    }
}

async function exportAttendanceList() {
    try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vR13cBu2nSz3Aj6QTXaTy6M4yz8nrZ0NWRkfcxABlUUDJ0L-zZUKY9qS1at7mvw4joyh2ihFndmTz2V/pub?gid=1115087104&single=true&output=csv');
        const text = await response.text();
        const data = parseCSV(text);

        const wb = XLSX.utils.book_new();
        
        // Create attendance worksheet
        const wsData = [
            ['Attendance', 'Name', 'School', 'Group', 'Contact', 'Pickup Point', 'Meal Preferences', 'Pretest Status']
        ];

        // Sort data by School first, then by Name
        const sortedData = [...data].sort((a, b) => {
            // First sort by school
            const schoolCompare = (a['參加者所屬學校'] || '').localeCompare(b['參加者所屬學校'] || '');
            if (schoolCompare !== 0) return schoolCompare;
            
            // If schools are the same, sort by name
            return (a['參加者中文全名'] || '').localeCompare(b['參加者中文全名'] || '');
        });

        sortedData.forEach(p => {
            wsData.push([
                '☐',
                p['參加者中文全名'],
                p['參加者所屬學校'],
                p['Group'],
                p['參加者手提電話'],
                p['去程集合點 (箭咀位置附近停車。實際停車位置視乎路況。)'],
                p['Meal Preferences'],
                p['Pretest Status']
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 5 },  // Attendance
            { wch: 25 }, // Name
            { wch: 35 }, // School
            { wch: 10 }, // Group
            { wch: 15 }, // Contact
            { wch: 35 }, // Pickup Point
            { wch: 25 }, // Meal Preferences
            { wch: 15 }  // Pretest Status
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, `attendance_list_${getFormattedDate()}.xlsx`);
    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed. Please try again.');
    }
}

async function exportTasks(format) {
    try {
        const roles = ['hwk', 'cat', 'may', 'herman', 'christine', 'alvin', 'archie', 'cathy', 'karindi', 'bonnie'];
        const wb = XLSX.utils.book_new();
        let hasData = false;

        for (const role of roles) {
            try {
                const response = await fetch(`../data/tasks/${role}.json`);
                if (!response.ok) {
                    console.warn(`No task data for role: ${role}`);
                    continue;
                }
                
                const data = await response.json();
                if (!data.tasks) continue;
                
                // Create worksheet for each role
                const taskRows = [];
                
                // Process each task category
                Object.entries(data.tasks).forEach(([category, categoryTasks]) => {
                    // Handle different task structures
                    if (Array.isArray(categoryTasks)) {
                        // Direct array of tasks
                        categoryTasks.forEach(task => {
                            taskRows.push({
                                Category: category,
                                TimeSlot: '',  // Empty for direct tasks
                                Time: task.time || '',
                                Task: task.text,
                                Tag: task.tag || ''
                            });
                        });
                    } else if (typeof categoryTasks === 'object') {
                        // Nested structure with time slots
                        Object.entries(categoryTasks).forEach(([timeSlot, tasks]) => {
                            if (Array.isArray(tasks)) {
                                tasks.forEach(task => {
                                    taskRows.push({
                                        Category: category,
                                        TimeSlot: timeSlot,
                                        Time: task.time || '',
                                        Task: task.text,
                                        Tag: task.tag || ''
                                    });
                                });
                            }
                        });
                    }
                });

                if (taskRows.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(taskRows);
                    
                    // Set column widths
                    ws['!cols'] = [
                        { wch: 15 }, // Category
                        { wch: 20 }, // TimeSlot
                        { wch: 15 }, // Time
                        { wch: 50 }, // Task
                        { wch: 15 }  // Tag
                    ];
                    
                    // Add worksheet name
                    const sheetName = data.name || role;
                    XLSX.utils.book_append_sheet(wb, ws, sheetName);
                    hasData = true;
                }
            } catch (error) {
                console.warn(`Error loading tasks for ${role}:`, error);
            }
        }

        if (!hasData) {
            throw new Error('No task data found');
        }

        XLSX.writeFile(wb, `tasks_${getFormattedDate()}.xlsx`);
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export tasks: ' + error.message);
    }
}

async function exportSchedule(format) {
    try {
        // Define the schedule data structure based on schedule.html
        const scheduleData = [
            ['Time', 'Activity', 'Focused Group'],
            ['10:00~10:15 (15min)', 'Registration', ''],
            ['10:15~10:30 (15min)', 'Welcome & Introduction', ''],
            ['10:30~11:00 (30min)', 'Mindful Walking (Nature Appreciation)\n→ Contingency if raining: Morning Practices\n→ Guided breathing (10 min)\n→ Body scan (15 min)\n→ Introspection/intention setting (5 min)', ''],
            ['11:00~12:30 (90min)', 'Mindful Calligraphy\n→ Practice (75 min)\n→ Gallery walk (15 min)', ''],
            ['12:30~13:00 (30min)', 'Mindful Meditation Journey', 'Group 1 (40)'],
            ['13:00~13:45 (45min)', 'Mindful Lunch', ''],
            ['13:45~13:55 (10min)', 'Post-lunch Centering', ''],
            ['13:55~14:55 (60min)', 'Tea Mindfulness\n→ Mindful tea tasting (20 min)\n→ Tea bag making (30 min)\n→ Reflection (10 min)', ''],
            ['14:55~15:30 (35min)', 'Sensory Awareness Experience\n→ Sound immersion (20 min)\n→ Mindful chocolate tasting (10 min)\n→ Reflection (5 min)', 'Group 2 (40)'],
            ['15:30~16:00 (30min)', 'Closing Circle\n→ Centering practice (15 min)\n→ Personal reflections (5 min)\n→ Gentle closure (10 min)', '']
        ];

        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(scheduleData);
            
            // Set column widths
            ws['!cols'] = [
                { wch: 25 }, // Time
                { wch: 50 }, // Activity
                { wch: 15 }  // Focused Group
            ];
            
            // Set row heights for cells with multiple lines
            const rowHeights = {};
            scheduleData.forEach((row, index) => {
                if (row[1] && row[1].includes('\n')) {
                    rowHeights[index] = 20 * (row[1].split('\n').length);
                }
            });
            if (Object.keys(rowHeights).length > 0) {
                ws['!rows'] = Array(scheduleData.length).fill(null).map((_, i) => ({
                    hpt: rowHeights[i] || 20
                }));
            }

            XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
            XLSX.writeFile(wb, `schedule_${getFormattedDate()}.xlsx`);
        } else {
            exportToCSV(scheduleData, 'schedule');
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export schedule: ' + error.message);
    }
}

async function exportInventory(format) {
    try {
        const wb = XLSX.utils.book_new();
        
        // Load items data
        const itemsResponse = await fetch('../data/items.csv');
        if (!itemsResponse.ok) {
            throw new Error('Failed to load items data');
        }
        const itemsText = await itemsResponse.text();
        const allItems = parseCSV(itemsText);
        
        // Load boxes data to get box names and zones
        const boxResponse = await fetch('../data/boxes.csv');
        if (!boxResponse.ok) {
            throw new Error('Failed to load boxes data');
        }
        const boxText = await boxResponse.text();
        const boxesData = parseCSV(boxText);
        
        // Create box name and zone mapping
        const boxInfo = {};
        boxesData.forEach(box => {
            boxInfo[box.boxid] = {
                name: box.name,
                zone: box.zoneid
            };
        });

        // Load zones data
        const zoneResponse = await fetch('../data/zones.csv');
        if (!zoneResponse.ok) {
            throw new Error('Failed to load zones data');
        }
        const zoneText = await zoneResponse.text();
        const zonesData = parseCSV(zoneText);
        
        // Create zone name mapping
        const zoneNames = {};
        zonesData.forEach(zone => {
            zoneNames[zone.zoneid] = zone.name;
        });

        if (allItems.length === 0) {
            throw new Error('No inventory data found');
        }

        // 1. Combined inventory sheet
        const allColumns = ['Item ID', 'Item Name', 'Total Quantity', 'Quantity in Box', 'Remaining Quantity', 'Notes', 'Category', 'Box Name'];
        const allItemsList = allItems.map(item => {
            const newItem = {};
            newItem['Item ID'] = item.itemid;
            newItem['Item Name'] = item.name;
            newItem['Total Quantity'] = item.totalquantity;
            newItem['Quantity in Box'] = item.quantityinbox;
            newItem['Remaining Quantity'] = item.remainingquantity;
            newItem['Notes'] = item.notes || '';
            newItem['Category'] = item.categoryid;
            newItem['Box Name'] = item.boxid ? boxInfo[item.boxid]?.name || 'Unknown Box' : 'Unboxed';
            return newItem;
        });
        
        const wsAll = XLSX.utils.json_to_sheet(allItemsList, { header: allColumns });
        setColumnWidths(wsAll, allItemsList);
        wsAll['!autofilter'] = { ref: wsAll['!ref'] }; // Enable filters
        XLSX.utils.book_append_sheet(wb, wsAll, 'All Items');

        // 2. Box-specific sheet
        const boxColumns = ['Item ID', 'Item Name', 'Total Quantity', 'Quantity in Box', 'Remaining Quantity', 'Notes', 'Box Name', 'Category'];
        const boxItems = allItems.map(item => {
            const newItem = {};
            newItem['Item ID'] = item.itemid;
            newItem['Item Name'] = item.name;
            newItem['Total Quantity'] = item.totalquantity;
            newItem['Quantity in Box'] = item.quantityinbox;
            newItem['Remaining Quantity'] = item.remainingquantity;
            newItem['Notes'] = item.notes || '';
            newItem['Box Name'] = item.boxid ? boxInfo[item.boxid]?.name || 'Unknown Box' : 'Unboxed';
            newItem['Category'] = item.categoryid;
            return newItem;
        });
        
        const wsBox = XLSX.utils.json_to_sheet(boxItems, { header: boxColumns });
        setColumnWidths(wsBox, boxItems);
        wsBox['!autofilter'] = { ref: wsBox['!ref'] }; // Enable filters
        XLSX.utils.book_append_sheet(wb, wsBox, 'By Box');

        // 3. Zone-specific sheet
        const zoneColumns = ['Item ID', 'Item Name', 'Total Quantity', 'Quantity in Box', 'Remaining Quantity', 'Notes', 'Zone', 'Box Name', 'Category'];
        const zoneItems = allItems.map(item => {
            const box = item.boxid ? boxInfo[item.boxid] : null;
            const zone = box ? box.zone : null;
            const zoneName = zone ? zoneNames[zone] : 'Unassigned';
            const boxName = box ? box.name : 'Unboxed';
            
            const newItem = {};
            newItem['Item ID'] = item.itemid;
            newItem['Item Name'] = item.name;
            newItem['Total Quantity'] = item.totalquantity;
            newItem['Quantity in Box'] = item.quantityinbox;
            newItem['Remaining Quantity'] = item.remainingquantity;
            newItem['Notes'] = item.notes || '';
            newItem['Zone'] = zoneName;
            newItem['Box Name'] = boxName;
            newItem['Category'] = item.categoryid;
            return newItem;
        });

        // Sort by zone
        zoneItems.sort((a, b) => {
            if (a.Zone === b.Zone) {
                return a['Box Name'].localeCompare(b['Box Name']);
            }
            return a.Zone.localeCompare(b.Zone);
        });

        const wsZone = XLSX.utils.json_to_sheet(zoneItems, { header: zoneColumns });
        setColumnWidths(wsZone, zoneItems);
        wsZone['!autofilter'] = { ref: wsZone['!ref'] }; // Enable filters
        XLSX.utils.book_append_sheet(wb, wsZone, 'By Zone');

        if (format === 'xlsx') {
            XLSX.writeFile(wb, `inventory_${getFormattedDate()}.xlsx`);
        } else {
            // For CSV, we'll only export the combined list
            exportToCSV(allItemsList, 'inventory');
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export inventory: ' + error.message);
    }
}

function exportBudget(format) {
    const budgetItems = JSON.parse(localStorage.getItem('budgetItems') || '[]');
    
    if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(budgetItems);
        XLSX.utils.book_append_sheet(wb, ws, 'Budget');
        XLSX.writeFile(wb, `budget_${getFormattedDate()}.xlsx`);
    } else {
        exportToCSV(budgetItems, 'budget');
    }
}

function parseCSV(csvText) {
    const BOM = '\uFEFF';
    const text = csvText.startsWith(BOM) ? csvText.slice(1) : csvText;
    const lines = text.split('\n');
    const headers = parseCSVLine(lines[0]);
    const data = [];

    console.log('Headers:', headers); // Debug log

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = parseCSVLine(lines[i]);
        console.log(`Row ${i}:`, values); // Debug log
        
        // Create row object even if values length doesn't match headers
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || ''; // Use empty string for missing values
        });
        
        // Only add rows that have at least one non-empty value
        if (Object.values(row).some(value => value.trim() !== '')) {
            data.push(row);
        }
    }

    return data;
}

function parseCSVLine(line) {
    const values = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
                // Handle escaped quotes
                currentValue += '"';
                i++;
            } else {
                // Toggle quote state
                insideQuotes = !insideQuotes;
                // Don't add the quote character
                continue;
            }
        } else if (char === ',' && !insideQuotes) {
            // End of field
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    
    // Add the last value
    values.push(currentValue.trim());
    
    return values;
}

function exportToCSV(data, filename) {
    const BOM = '\uFEFF';
    let csvContent = BOM;
    
    if (Array.isArray(data[0])) {
        // For array of arrays (like schedule data)
        csvContent += data.map(row => row.join(',')).join('\n');
    } else {
        // For array of objects
        const headers = Object.keys(data[0]);
        csvContent += headers.join(',') + '\n';
        csvContent += data.map(row => 
            headers.map(field => JSON.stringify(row[field] || '')).join(',')
        ).join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${getFormattedDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function getFormattedDate() {
    return new Date().toISOString().split('T')[0];
}

// Helper function to set column widths
function setColumnWidths(worksheet, data) {
    if (!data || data.length === 0) return;
    
    const maxWidth = 50;
    const cols = Object.keys(data[0]).map(key => ({
        wch: Math.min(maxWidth, Math.max(
            key.length,
            ...data.map(row => String(row[key] || '').length)
        ))
    }));
    worksheet['!cols'] = cols;
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadRoles();
});
