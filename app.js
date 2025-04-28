// Define expense categories with subcategories
const expenseCategories = {
    "Food & Dining": [
        "Groceries",
        "Restaurants",
        "Coffee Shops",
        "Food Delivery",
        "Snacks"
    ],
    "Transportation": [
        "Public Transit",
        "Taxi/Rideshare",
        "Gas",
        "Parking",
        "Car Maintenance",
        "Car Insurance"
    ],
    "Housing": [
        "Rent/Mortgage",
        "Utilities",
        "Internet",
        "Maintenance",
        "Furniture",
        "Household Supplies"
    ],
    "Entertainment": [
        "Movies",
        "Music",
        "Games",
        "Concerts",
        "Subscriptions",
        "Hobbies"
    ],
    "Shopping": [
        "Clothing",
        "Electronics",
        "Books",
        "Personal Care",
        "Gifts"
    ],
    "Health": [
        "Medical",
        "Pharmacy",
        "Fitness",
        "Health Insurance"
    ],
    "Travel": [
        "Flights",
        "Hotels",
        "Vacation",
        "Travel Insurance"
    ],
    "Education": [
        "Tuition",
        "Books",
        "Courses",
        "School Supplies"
    ],
    "Personal": [
        "Self-care",
        "Haircut",
        "Spa",
        "Other Personal"
    ],
    "Bills & Utilities": [
        "Phone",
        "Electricity",
        "Water",
        "Gas",
        "Internet",
        "Streaming Services"
    ],
    "Other": [
        "Miscellaneous"
    ]
};

// Set up event listeners
document.getElementById("expForm").addEventListener("submit", addExpense);
document.getElementById("categoryChartBtn").addEventListener("click", () => renderChart('category'));
document.getElementById("dateChartBtn").addEventListener("click", () => renderChart('date'));
document.getElementById("paymentChartBtn").addEventListener("click", () => renderChart('payment'));
document.getElementById("category").addEventListener("change", updateSubcategories);
document.getElementById("setBudgetBtn").addEventListener("click", setBudget);
document.getElementById("applyFiltersBtn").addEventListener("click", applyFilters);
document.getElementById("resetFiltersBtn").addEventListener("click", resetFilters);

// Initialize data from localStorage
const expenses = JSON.parse(localStorage.getItem("expenses")) || [];
const budgets = JSON.parse(localStorage.getItem("budgets")) || {};

// Chart reference to update it later
let expenseChart = null;
let activeFilters = {
    category: 'all',
    month: 'all'
};

// Initialize the page
initializePage();

/**
   * Processes recurring expenses that are due or past due, cloning them with updated dates and scheduling the next occurrence.
   *
   * For each recurring expense whose next due date is today or earlier, creates a new expense entry for the due date, updates the next due date based on the recurrence frequency, and sends a browser notification if permission is granted.
   *
   * @remark Updates the `expenses` array and persists changes to localStorage.
   */
function migrateRecurring() {
    const today = new Date().toISOString().substr(0,10);
    expenses.slice().forEach(exp => {
      if (exp.recurring && exp.nextDate && exp.nextDate <= today) {
        // Notify if due today
        if (Notification.permission === 'granted') {
          new Notification('Expense Reminder', {
            body: `${exp.name}: $${exp.amount.toFixed(2)} is due today.`
          });
        }
        // Clone instance
        const cloned = { ...exp };
        cloned.id = expenses[expenses.length-1].id + 1;
        cloned.date = exp.nextDate;
        // Compute next due date
        cloned.nextDate = computeNextDate(new Date(exp.nextDate), exp.frequency)
                            .toISOString().substr(0,10);
        expenses.push(cloned);
        // Advance original’s nextDate so we don’t loop
        exp.nextDate = cloned.nextDate;
      }
    });
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }
  
/**
 * Initializes the expense tracker application UI and data.
 *
 * Sets up recurring expense migration, populates category and filter dropdowns, displays expenses, updates the budget overview, renders the initial chart if expenses exist, and requests browser notification permission if needed.
 */
function initializePage() {
    migrateRecurring(); 
    populateCategoryDropdowns();
    showExpenses();
    updateBudgetOverview();
    populateFilterDropdowns();
    
    // Render initial chart if there are expenses
    if (expenses.length > 0) {
        renderChart('category');
    }
      // ask once for browser notifications
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/**
 * Populates the category selection dropdowns for expense entry, budget setting, and filtering with available categories.
 *
 * Updates the relevant dropdown elements in the UI to reflect the current set of categories defined in {@link expenseCategories}.
 */
function populateCategoryDropdowns() {
    const categorySelect = document.getElementById("category");
    const budgetCategorySelect = document.getElementById("budgetCategory");
    const filterCategorySelect = document.getElementById("filterCategory");
    
    // Clear existing options except the first one
    categorySelect.innerHTML = '<option value="chooseOne">Choose one...</option>';
    budgetCategorySelect.innerHTML = '';
    
    // Add categories to dropdowns
    Object.keys(expenseCategories).forEach(category => {
        // Main form dropdown
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
        
        // Budget form dropdown
        const budgetOption = document.createElement("option");
        budgetOption.value = category;
        budgetOption.textContent = category;
        budgetCategorySelect.appendChild(budgetOption);
        
        // Filter dropdown (if it doesn't already exist)
        if (!Array.from(filterCategorySelect.options).some(opt => opt.value === category)) {
            const filterOption = document.createElement("option");
            filterOption.value = category;
            filterOption.textContent = category;
            filterCategorySelect.appendChild(filterOption);
        }
    });
}

/**
 * Updates the subcategory dropdown options based on the selected main category.
 *
 * If a valid category is selected, populates the subcategory dropdown with its subcategories; otherwise, only a default option is shown.
 */
function updateSubcategories() {
    const categorySelect = document.getElementById("category");
    const subcategorySelect = document.getElementById("subcategory");
    const selectedCategory = categorySelect.value;
    
    // Clear existing options
    subcategorySelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "chooseOne";
    defaultOption.textContent = "Choose one...";
    subcategorySelect.appendChild(defaultOption);
    
    // If a valid category is selected, populate subcategories
    if (selectedCategory !== "chooseOne" && expenseCategories[selectedCategory]) {
        expenseCategories[selectedCategory].forEach(subcategory => {
            const option = document.createElement("option");
            option.value = subcategory;
            option.textContent = subcategory;
            subcategorySelect.appendChild(option);
        });
    }
}

/**
 * Populates the month filter dropdown with unique months from recorded expenses, sorted chronologically.
 *
 * Ensures users can filter expenses by any month present in the data.
 */
function populateFilterDropdowns() {
    const filterMonthSelect = document.getElementById("filterMonth");
    
    // Clear existing month options except the first one
    filterMonthSelect.innerHTML = '<option value="all">All Months</option>';
    
    // Get unique months from expenses
    const months = new Set();
    expenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        months.add(monthYear);
    });
    
    // Sort months chronologically
    const sortedMonths = Array.from(months).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA - dateB;
    });
    
    // Add months to dropdown
    sortedMonths.forEach(month => {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = month;
        filterMonthSelect.appendChild(option);
    });
}

/**
 * Handles the submission of a new expense, validating input fields and adding the expense to the list.
 *
 * If the expense is marked as recurring, calculates the next due date based on the selected frequency.
 * Updates localStorage, refreshes the expense display, budget overview, filter options, and category chart.
 *
 * @param {Event} e - The form submission event.
 */
function addExpense(e) {
    e.preventDefault();

    let category = document.getElementById("category").value;
    let subcategory = document.getElementById("subcategory").value;
    let paymentType = document.getElementById("paymentType").value;
    let name = document.getElementById("name").value;
    let date = document.getElementById("date").value;
    let amount = document.getElementById("amount").value;
    // ▼ Recurrence fields ▼
    let recurring = document.getElementById('recurring').checked;
    let frequency = recurring 
        ? document.getElementById('recurrence').value 
        : null;
    

    if (
        category !== "chooseOne" && 
        subcategory !== "chooseOne" && 
        paymentType !== "chooseOne" && 
        name.length > 0 && 
        date && 
        amount > 0
        
    ) {
        const expense = {
            category,
            subcategory,
            paymentType,
            name,
            date,
            amount: parseFloat(amount), // Convert to number for calculations
            recurring,       // true/false
            frequency,       // "daily" | "weekly" | "monthly" | null
            nextDate: recurring 
              ? computeNextDate(new Date(date), frequency)
                  .toISOString().substr(0,10)
              : null,
      
            id: expenses.length > 0 ? expenses[expenses.length - 1].id + 1 : 1,
        };

        expenses.push(expense);
        // Save to localStorage
        localStorage.setItem("expenses", JSON.stringify(expenses));

        document.getElementById('expForm').reset();
        showExpenses();
        updateBudgetOverview();
        populateFilterDropdowns();
        renderChart('category'); // Update chart after adding expense
    } else {
        alert("Please fill in all fields correctly.");
    }
}

/**
 * Displays the list of expenses in the table, applying active category and month filters.
 *
 * If no expenses match the current filters, shows a message indicating no expenses were found.
 */
function showExpenses() {
    const expenseTable = document.getElementById('expenseTable');
    expenseTable.innerHTML = '';
    
    // Apply filters
    let filteredExpenses = expenses.filter(expense => {
        // Filter by category
        if (activeFilters.category !== 'all' && expense.category !== activeFilters.category) {
            return false;
        }
        
        // Filter by month
        if (activeFilters.month !== 'all') {
            const expenseDate = new Date(expense.date);
            const expenseMonthYear = expenseDate.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (expenseMonthYear !== activeFilters.month) {
                return false;
            }
        }
        
        return true;
    });

    if (filteredExpenses.length === 0) {
        expenseTable.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center;">No expenses found</td>
            </tr>
        `;
        return;
    }

    for (let i = 0; i < filteredExpenses.length; i++) {
        expenseTable.innerHTML += `
            <tr>
                <td>${filteredExpenses[i].category}</td>
                <td>${filteredExpenses[i].subcategory}</td>
                <td>${filteredExpenses[i].paymentType}</td>
                <td>${filteredExpenses[i].name}</td>
                <td>${filteredExpenses[i].date}</td>
                <td>$${filteredExpenses[i].amount.toFixed(2)}</td>
                <td><a class="deleteButton" onclick="deleteExpense(${filteredExpenses[i].id})">
                    Delete</td>
            </tr>
        `;
    }
}

/**
 * Removes an expense by its ID and updates all related displays and data.
 *
 * After deletion, updates the expense list, budget overview, filter options, and category chart.
 *
 * @param {string|number} id - The unique identifier of the expense to remove.
 */
function deleteExpense(id) {
    for (let i = 0; i < expenses.length; i++) {
        if (expenses[i].id == id) {
            expenses.splice(i, 1);
        }
    }

    // Save to localStorage
    localStorage.setItem('expenses', JSON.stringify(expenses));
    showExpenses();
    updateBudgetOverview();
    populateFilterDropdowns();
    renderChart('category'); // Update chart after deleting expense
}

/**
 * Applies the selected category and month filters to the expense list.
 *
 * Updates the active filters based on user selections and refreshes the displayed expenses accordingly.
 */
function applyFilters() {
    const categoryFilter = document.getElementById("filterCategory").value;
    const monthFilter = document.getElementById("filterMonth").value;
    
    activeFilters = {
        category: categoryFilter,
        month: monthFilter
    };
    
    showExpenses();
}

/**
 * Resets all expense filters to show every expense.
 *
 * Sets the category and month filters to 'all', clears active filters, and refreshes the expense display.
 */
function resetFilters() {
    document.getElementById("filterCategory").value = 'all';
    document.getElementById("filterMonth").value = 'all';
    
    activeFilters = {
        category: 'all',
        month: 'all'
    };
    
    showExpenses();
}

/**
 * Generates a random hex color string.
 *
 * @returns {string} A random color in hexadecimal format (e.g., "#3E2F1B").
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

/**
 * Aggregates expenses by category, payment method, or month, summing the total amount for each group.
 *
 * @param {string} groupBy - The grouping criterion: 'category', 'payment', or 'date'.
 * @returns {Object} An object mapping each group (category, payment type, or month-year) to the total expense amount. For 'date', groups are sorted chronologically.
 */
function groupExpenses(groupBy) {
    const grouped = {};
    
    if (groupBy === 'category') {
        // Group by expense category
        expenses.forEach(expense => {
            if (!grouped[expense.category]) {
                grouped[expense.category] = 0;
            }
            grouped[expense.category] += parseFloat(expense.amount);
        });
    } else if (groupBy === 'payment') {
        // Group by payment method
        expenses.forEach(expense => {
            if (!grouped[expense.paymentType]) {
                grouped[expense.paymentType] = 0;
            }
            grouped[expense.paymentType] += parseFloat(expense.amount);
        });
    } else if (groupBy === 'date') {
        // Group by month
        expenses.forEach(expense => {
            // Extract month and year from date
            const dateObj = new Date(expense.date);
            const monthYear = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
            
            if (!grouped[monthYear]) {
                grouped[monthYear] = 0;
            }
            grouped[monthYear] += parseFloat(expense.amount);
        });
        
        // Sort dates chronologically
        const sortedGrouped = {};
        Object.keys(grouped)
            .sort((a, b) => new Date(a) - new Date(b))
            .forEach(key => {
                sortedGrouped[key] = grouped[key];
            });
            
        return sortedGrouped;
    }
    
    return grouped;
}

/**
 * Renders an expense chart based on the selected grouping type.
 *
 * Updates the chart display to show expenses grouped by category, payment method, or month, using a pie or bar chart as appropriate. The chart is dynamically updated with random colors and an appropriate title.
 *
 * @param {string} chartType - The grouping type for the chart ('category', 'payment', or 'date').
 */
function renderChart(chartType) {
    // Update active tab
    document.querySelectorAll('.chart-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(chartType + 'ChartBtn').classList.add('active');
    
    // Group data based on chart type
    const groupedData = groupExpenses(chartType);
    const labels = Object.keys(groupedData);
    const data = Object.values(groupedData);
    
    // Generate colors
    const backgroundColors = labels.map(() => getRandomColor());
    
    // Chart configuration
    const chartConfig = {
        type: chartType === 'date' ? 'bar' : 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Amount ($)',
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: getChartTitle(chartType),
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: chartType === 'date' ? 'top' : 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            return `${label}: $${value.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    };
    
    // If chart already exists, destroy it first
    if (expenseChart) {
        expenseChart.destroy();
    }
    
    // Create new chart
    const ctx = document.getElementById('expenseChart').getContext('2d');
    expenseChart = new Chart(ctx, chartConfig);
}

/**
 * Returns a descriptive chart title based on the specified chart type.
 *
 * @param {string} chartType - The type of chart grouping ('category', 'date', or 'payment').
 * @returns {string} The corresponding chart title.
 */
function getChartTitle(chartType) {
    switch(chartType) {
        case 'category':
            return 'Expenses by Category';
        case 'date':
            return 'Expenses by Month';
        case 'payment':
            return 'Expenses by Payment Method';
        default:
            return 'Expense Chart';
    }
}

/**
 * Sets the budget amount for a selected expense category.
 *
 * Updates the stored budgets and refreshes the budget overview display. Alerts the user on success or if input is invalid.
 */
function setBudget() {
    const category = document.getElementById("budgetCategory").value;
    const amount = parseFloat(document.getElementById("budgetAmount").value);
    
    if (category && amount > 0) {
        budgets[category] = amount;
        localStorage.setItem("budgets", JSON.stringify(budgets));
        updateBudgetOverview();
        document.getElementById("budgetAmount").value = "";
        alert(`Budget set for ${category}: $${amount.toFixed(2)}`);
    } else {
        alert("Please select a category and enter a valid budget amount");
    }
}

/**
 * Updates the budget overview display with current month's spending and progress for each budgeted category.
 *
 * Shows budget amounts, spent and remaining values, progress bars, and alerts if spending exceeds 90% of a category's budget. If no budgets are set, displays a prompt to set budgets.
 */
function updateBudgetOverview() {
    const budgetOverview = document.getElementById("budgetOverview");
    budgetOverview.innerHTML = '';
    
    // Get current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Calculate expenses for current month by category
    const currentMonthExpenses = {};
    expenses.forEach(expense => {
        const expenseDate = new Date(expense.date);
        if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
            if (!currentMonthExpenses[expense.category]) {
                currentMonthExpenses[expense.category] = 0;
            }
            currentMonthExpenses[expense.category] += expense.amount;
        }
    });
    
    // Check if any budgets are set
    if (Object.keys(budgets).length === 0) {
        budgetOverview.innerHTML = '<p>No budgets set. Set a budget for a category to see your spending progress.</p>';
        return;
    }
    
    // Create budget progress bars
    Object.keys(budgets).forEach(category => {
        const budgetAmount = budgets[category];
        const spent = currentMonthExpenses[category] || 0;
        const remaining = budgetAmount - spent;
        const percentage = Math.min((spent / budgetAmount) * 100, 100);
        
        // Determine status class
        let statusClass = '';
        if (percentage >= 90) {
            statusClass = 'danger';
        } else if (percentage >= 75) {
            statusClass = 'warning';
        }
        
        budgetOverview.innerHTML += `
            <div class="budget-item">
                <div class="budget-item-header">
                    <div class="budget-item-title">${category}</div>
                    <div>${getMonthName(currentMonth)} ${currentYear}</div>
                </div>
                <div class="budget-item-amount">
                    <div>Budget: $${budgetAmount.toFixed(2)}</div>
                    <div>Spent: $${spent.toFixed(2)}</div>
                    <div>Remaining: $${remaining.toFixed(2)}</div>
                </div>
                <div class="budget-progress">
                    <div class="budget-progress-bar ${statusClass}" style="width: ${percentage}%">
                        ${percentage.toFixed(0)}%
                    </div>
                </div>
                ${percentage >= 90 ? `
                <div class="budget-alert">
                    Alert: You've used ${percentage.toFixed(0)}% of your ${category} budget!
                </div>
                ` : ''}
            </div>
        `;
    });
    
    // Show alerts for budgets over 90%
    const alerts = document.querySelectorAll('.budget-alert');
    alerts.forEach(alert => {
        alert.style.display = 'block';
    });
}

/**
 * Returns the full month name for a given zero-based month index.
 *
 * @param {number} monthIndex - The zero-based index of the month (0 for January, 11 for December).
 * @returns {string} The name of the month corresponding to {@link monthIndex}.
 */
function getMonthName(monthIndex) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
}

/**
 * Migrates legacy expense data to the current format with category and subcategory fields.
 *
 * Converts expenses lacking a `category` property to include default values and updates localStorage. Reloads the page after migration.
 */
function migrateOldData() {
    if (expenses.length > 0 && !expenses[0].hasOwnProperty('category')) {
        const migratedExpenses = expenses.map(expense => {
            return {
                category: 'Other',
                subcategory: 'Miscellaneous',
                paymentType: expense.type || 'Other',
                name: expense.name,
                date: expense.date,
                amount: parseFloat(expense.amount),
                id: expense.id
            };
        });
        
        localStorage.setItem("expenses", JSON.stringify(migratedExpenses));
        window.location.reload();
    }
}
/**
   * Calculates the next occurrence date for a recurring event based on the specified frequency.
   *
   * @param {Date} dateObj - The current date of the event.
   * @param {string} frequency - The recurrence frequency ('daily', 'weekly', or 'monthly').
   * @returns {Date} The next occurrence date according to the given frequency.
   */
function computeNextDate(dateObj, frequency) {
    const next = new Date(dateObj);
    if (frequency === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (frequency === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }
  

// Call data migration function on load
migrateOldData();