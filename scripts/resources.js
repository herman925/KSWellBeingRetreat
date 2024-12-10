class ResourceManager {
    constructor() {
        this.zones = [];
        this.categories = [];
        this.items = [];
        this.boxes = [];
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.renderZones();
            this.renderInventory();
            this.renderBoxes();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing:', error);
        }
    }

    async loadData() {
        const [zonesText, categoriesText, itemsText, boxesText] = await Promise.all([
            fetch('../data/zones.csv').then(response => response.text()),
            fetch('../data/categories.csv').then(response => response.text()),
            fetch('../data/items.csv').then(response => response.text()),
            fetch('../data/boxes.csv').then(response => response.text())
        ]);

        this.zones = this.parseCSV(zonesText);
        this.categories = this.parseCSV(categoriesText);
        this.items = this.parseCSV(itemsText).map(item => {
            const remainingQty = parseInt(item.remainingquantity || '0');
            const boxQty = parseInt(item.quantityinbox || '0');
            
            return {
                ...item,
                remainingquantity: remainingQty.toString(),
                quantityinbox: boxQty.toString(),
                totalquantity: (remainingQty + boxQty).toString()
            };
        });
        this.boxes = this.parseCSV(boxesText);
    }

    async importFromCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const items = this.parseCSV(text).map(item => {
                const remainingQty = parseInt(item.remainingquantity || '0');
                const boxQty = parseInt(item.quantityinbox || '0');
                
                return {
                    ...item,
                    remainingquantity: remainingQty.toString(),
                    quantityinbox: boxQty.toString(),
                    totalquantity: (remainingQty + boxQty).toString()
                };
            });

            this.items = items;
            this.renderInventory();
            this.renderBoxes();
            console.log('CSV imported successfully');
        } catch (error) {
            console.error('Error importing CSV:', error);
            alert('Failed to import CSV file. Please check the file format.');
        }
        
        // Clear the file input so the same file can be selected again
        event.target.value = '';
    }

    async exportToCSV() {
        try {
            const headers = ['itemid', 'name', 'totalquantity', 'remainingquantity', 'notes', 'categoryid', 'boxid', 'quantityinbox'];
            const rows = this.items.map(item => {
                return headers.map(header => {
                    const value = item[header] || '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',');
            });
            
            const csvContent = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'items.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            
            console.log('CSV exported successfully');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Failed to export CSV file. Please try again.');
        }
    }

    async updateItemQuantity(itemId, field, newValue) {
        const item = this.items.find(item => item.itemid === itemId);
        if (!item) return;

        newValue = parseInt(newValue);
        if (isNaN(newValue) || newValue < 0) {
            alert('Please enter a valid number (0 or greater)');
            return;
        }

        const boxQty = parseInt(item.quantityinbox || 0);
        const remainingQty = parseInt(item.remainingquantity || 0);

        if (field === 'remainingquantity') {
            if (newValue < 0) {
                alert('Quantity cannot be negative');
                return;
            }
            
            item.remainingquantity = newValue.toString();
            item.totalquantity = (newValue + boxQty).toString();
        } else if (field === 'quantityinbox') {
            const currentTotal = remainingQty + boxQty;
            
            if (newValue > currentTotal) {
                newValue = currentTotal;
            }
            
            item.quantityinbox = newValue.toString();
            item.remainingquantity = (currentTotal - newValue).toString();
            item.totalquantity = currentTotal.toString();
        }

        this.renderInventory();
        this.renderBoxes();
    }

    renderQuantityBox(item, field) {
        const value = parseInt(item[field] || 0);
        const isEmpty = value === 0;
        return `
            <span class="item-quantity editable" data-itemid="${item.itemid}" data-field="${field}">
                <input type="number" value="${value}" min="0" 
                    class="quantity-input ${isEmpty ? 'empty-quantity' : ''}"
                    style="${isEmpty ? 'color: red;' : ''}"
                    onfocus="this.select();"
                    onblur="window.resourceManager.updateItemQuantity('${item.itemid}', '${field}', this.value);"
                    onkeypress="if(event.key === 'Enter') this.blur();">
            </span>
        `;
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        return lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header.trim()] = values[index]?.trim() || '';
                return obj;
            }, {});
        });
    }

    setupEventListeners() {
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                const content = header.nextElementSibling;
                header.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            });
        });
    }

    render() {
        this.renderZones();
        this.renderInventory();
        this.renderBoxes();
        this.setupEventListeners();
    }

    renderZones() {
        const zonesContainer = document.getElementById('zones-list');
        zonesContainer.innerHTML = '';

        const sortedZones = this.zones.sort((a, b) => a.order - b.order);

        const zonesList = document.createElement('ul');
        zonesList.className = 'items-list';

        sortedZones.forEach(zone => {
            const zoneElement = document.createElement('li');
            zoneElement.className = 'item';
            zoneElement.innerHTML = `
                <div class="zone-info">
                    <span class="item-name">${zone.name}</span>
                    <span class="zone-description">${zone.description || ''}</span>
                </div>
            `;
            zonesList.appendChild(zoneElement);
        });

        zonesContainer.appendChild(zonesList);
    }

    renderInventory() {
        const inventoryContainer = document.getElementById('inventory-list');
        inventoryContainer.innerHTML = '';

        const sortedCategories = this.categories.sort((a, b) => a.order - b.order);

        sortedCategories.forEach(category => {
            const categorySection = document.createElement('div');
            categorySection.className = 'category-section';

            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'collapsible-header';
            categoryHeader.innerHTML = `
                <i class="fas fa-chevron-down"></i>
                <span>${category.name}</span>
            `;

            const categoryContent = document.createElement('div');
            categoryContent.className = 'box-content';

            const itemsList = document.createElement('ul');
            itemsList.className = 'items-list';

            const categoryItems = this.items.filter(item => item.categoryid === category.categoryid)
                .sort((a, b) => a.name.localeCompare(b.name));

            categoryItems.forEach(item => {
                const itemElement = document.createElement('li');
                itemElement.className = 'item';
                const notes = item.notes ? `<span class="item-notes">(${item.notes})</span>` : '';
                itemElement.innerHTML = `
                    <div class="item-info">
                        <span class="item-name">${item.name}</span>
                        ${notes}
                    </div>
                    ${this.renderQuantityBox(item, 'remainingquantity')}
                `;
                itemsList.appendChild(itemElement);
            });

            categoryContent.appendChild(itemsList);
            categorySection.appendChild(categoryHeader);
            categorySection.appendChild(categoryContent);
            inventoryContainer.appendChild(categorySection);
        });
    }

    renderBoxes() {
        const boxesContainer = document.getElementById('boxes-list');
        boxesContainer.innerHTML = '';

        const boxesByZone = {};
        this.boxes.sort((a, b) => a.order - b.order).forEach(box => {
            if (!boxesByZone[box.zoneid]) {
                boxesByZone[box.zoneid] = [];
            }
            boxesByZone[box.zoneid].push(box);
        });

        Object.entries(boxesByZone).forEach(([zoneid, boxes]) => {
            const zone = this.zones.find(zone => zone.zoneid === zoneid);
            if (!zone) return;

            const zoneSection = document.createElement('div');
            zoneSection.className = 'zone-section';

            const zoneHeader = document.createElement('div');
            zoneHeader.className = 'collapsible-header';
            zoneHeader.innerHTML = `
                <i class="fas fa-chevron-down"></i>
                <span>${zone.name}</span>
            `;

            const zoneContent = document.createElement('div');
            zoneContent.className = 'zone-content';

            boxes.forEach(box => {
                const boxSection = document.createElement('div');
                boxSection.className = 'box-section';

                const boxHeader = document.createElement('div');
                boxHeader.className = 'collapsible-header';
                boxHeader.innerHTML = `
                    <i class="fas fa-chevron-down"></i>
                    <span>${box.name}</span>
                `;

                const boxContent = document.createElement('div');
                boxContent.className = 'box-content';

                const itemsList = document.createElement('ul');
                itemsList.className = 'box-items-list';

                const boxItems = this.items.filter(item => item.boxid === box.boxid);
                boxItems.forEach(item => {
                    const itemElement = document.createElement('li');
                    itemElement.className = 'box-item';
                    const notes = item.notes ? `<span class="item-notes">(${item.notes})</span>` : '';
                    itemElement.innerHTML = `
                        <div class="item-info">
                            <span class="item-name">${item.name}</span>
                            ${notes}
                        </div>
                        ${this.renderQuantityBox(item, 'quantityinbox')}
                    `;
                    itemsList.appendChild(itemElement);
                });

                boxContent.appendChild(itemsList);
                boxSection.appendChild(boxHeader);
                boxSection.appendChild(boxContent);
                zoneContent.appendChild(boxSection);
            });

            zoneSection.appendChild(zoneHeader);
            zoneSection.appendChild(zoneContent);
            boxesContainer.appendChild(zoneSection);
        });
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const roleSelect = document.getElementById('roleSelect');
    
    // Load roles from JSON
    try {
        const response = await fetch('../data/roles.json');
        const data = await response.json();
        
        // Clear existing options except the default one
        roleSelect.innerHTML = '<option value="">Select Your Role</option>';
        
        // Add roles from JSON
        data.roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = `${role.name}${role.title ? ` (${role.title})` : ''}`;
            roleSelect.appendChild(option);
        });
        
        // Load saved role from localStorage
        const savedRole = localStorage.getItem('selectedRole');
        if (savedRole) {
            roleSelect.value = savedRole;
        }
    } catch (error) {
        console.error('Error loading roles:', error);
    }

    // Role selection handler
    roleSelect.addEventListener('change', function() {
        const selectedRole = this.value;
        localStorage.setItem('selectedRole', selectedRole);
    });

    window.resourceManager = new ResourceManager();
});
