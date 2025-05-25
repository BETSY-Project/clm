document.addEventListener('DOMContentLoaded', () => {
    const logColumnsContainer = document.getElementById('log-columns');
    const services = ['client', 'server']; // Define the services to display

    // Base URL for the API
    const API_BASE_URL = window.location.origin; // Assumes Flask serves on the same origin

    // Function to format timestamp
    function formatTimestamp(nanoTimestamp) {
        const date = new Date(nanoTimestamp / 1000000); // Convert nanoseconds to milliseconds
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`; // YYYY-MM-DD HH:MM:SS.mmm format
    }

    // Helper function to create a single log entry DOM element
    function createLogElement(log) {
        const logWrapperDiv = document.createElement('div');
        logWrapperDiv.className = 'log-entry-wrapper';

        const logEntryDiv = document.createElement('div');
        logEntryDiv.className = 'log-entry cursor-pointer flex items-center';

        let textColorClass = 'text-black';
        switch (log.level.toLowerCase()) {
            case 'success':
                textColorClass = 'text-green-600';
                break;
            case 'warning':
                textColorClass = 'text-orange-500';
                break;
            case 'error':
                textColorClass = 'text-red-600';
                break;
            case 'debug':
                textColorClass = 'text-gray-500';
                break;
            // 'info' will use the default 'text-black'
        }
        logEntryDiv.classList.add(textColorClass);

        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'arrow-indicator mr-2';
        arrowSpan.textContent = '▶';

        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'font-mono text-xs mr-2 text-gray-500 flex-shrink-0';
        timestampSpan.textContent = formatTimestamp(log.timestamp);

        const messageSpan = document.createElement('span');
        messageSpan.className = 'flex-grow';
        messageSpan.textContent = log.message;

        logEntryDiv.appendChild(arrowSpan);
        logEntryDiv.appendChild(timestampSpan);
        logEntryDiv.appendChild(messageSpan);
        logWrapperDiv.appendChild(logEntryDiv);

        if (log.details) {
            arrowSpan.style.visibility = 'visible';
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'log-details hidden ml-5 p-2 border-l-2 border-gray-300';

            if (typeof log.details === 'string') {
                try {
                    const parsedDetails = JSON.parse(log.details);
                    if (typeof parsedDetails === 'object' && parsedDetails !== null) {
                        const pre = document.createElement('pre');
                        pre.className = 'text-xs whitespace-pre-wrap break-all';
                        pre.textContent = JSON.stringify(parsedDetails, null, 2);
                        detailsDiv.appendChild(pre);
                    } else {
                        const pre = document.createElement('pre');
                        pre.className = 'text-xs whitespace-pre-wrap break-all';
                        pre.textContent = log.details;
                        detailsDiv.appendChild(pre);
                    }
                } catch (e) {
                    const pre = document.createElement('pre');
                    pre.className = 'text-xs whitespace-pre-wrap break-all';
                    pre.textContent = log.details;
                    detailsDiv.appendChild(pre);
                }
            } else if (log.details !== null && log.details !== undefined) {
                const pre = document.createElement('pre');
                pre.className = 'text-xs whitespace-pre-wrap break-all';
                pre.textContent = String(log.details);
                detailsDiv.appendChild(pre);
            }
            logWrapperDiv.appendChild(detailsDiv);

            logEntryDiv.addEventListener('click', () => {
                detailsDiv.classList.toggle('hidden');
                arrowSpan.textContent = detailsDiv.classList.contains('hidden') ? '▶' : '▼';
            });
        } else {
            arrowSpan.style.visibility = 'hidden';
            logEntryDiv.classList.remove('cursor-pointer');
        }
        return logWrapperDiv;
    }

    // Function to append a single log to the container and scroll
    function appendLogToContainer(log, logsContainer, serviceName) {
        const logElement = createLogElement(log);
        const placeholder = logsContainer.querySelector('p.text-gray-500, p.text-red-500');
        if (placeholder) {
            logsContainer.innerHTML = '';
        }

        const isScrolledToBottom = logsContainer.scrollHeight - logsContainer.scrollTop <= logsContainer.clientHeight + 30;

        logsContainer.appendChild(logElement);

        if (isScrolledToBottom) {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
        updateDisplayedCount(serviceName);
    }

    // Function to update the displayed log count for a service
    function updateDisplayedCount(serviceName) {
        const logsContainer = document.getElementById(`logs-container-${serviceName}`);
        const displayedCountElement = document.getElementById(`displayed-count-${serviceName}`);
        if (logsContainer && displayedCountElement) {
            const count = logsContainer.querySelectorAll('.log-entry-wrapper').length;
            displayedCountElement.textContent = `Displayed: ${count}`;
        }
    }

    // Function to fetch and update DB log count in the title
    async function fetchAndUpdateDbCount(serviceName) {
        const dbCountSpanElement = document.getElementById(`db-count-${serviceName}`);
        if (!dbCountSpanElement) {
            console.error(`[${serviceName}] Span element db-count-${serviceName} not found.`);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/logs/count?service=${serviceName}`);
            if (!response.ok) {
                console.error(`[${serviceName}] HTTP error fetching DB count: ${response.status} ${response.statusText}`);
                dbCountSpanElement.textContent = `E:${response.status}`; // Error indicator
                return;
            }
            const data = await response.json();
            if (data && typeof data.count === 'number') {
                dbCountSpanElement.textContent = data.count.toString();
            } else {
                console.error(`[${serviceName}] DB count is not a number or data is malformed. Data:`, data);
                dbCountSpanElement.textContent = 'N/A'; // Not Available/Malformed
            }
        } catch (error) {
            console.error(`[${serviceName}] Exception fetching/processing DB count:`, error);
            dbCountSpanElement.textContent = 'ERR'; // General Error
        }
    }

    // Function to clear logs for a service
    async function clearLogs(serviceName, logsContainer) {
        if (!confirm(`Are you sure you want to delete all logs for '${serviceName}'?`)) {
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/logs/${serviceName}`, { method: 'DELETE' });
            if (!response.ok) {
                alert(`Error clearing logs for ${serviceName}: ${response.statusText}`);
                return;
            }
            await response.json();
            logsContainer.innerHTML = '<p class="text-gray-500">No logs yet.</p>';
            updateDisplayedCount(serviceName); // Update displayed count to 0
            fetchAndUpdateDbCount(serviceName); // Update DB count in title
        } catch (error) {
            console.error(`Error clearing logs for ${serviceName}:`, error);
            alert(`Failed to clear logs for ${serviceName}.`);
        }
    }

    // Function to toggle all log details in a column
    function toggleAllLogDetails(serviceName, expand) {
        const logsContainer = document.getElementById(`logs-container-${serviceName}`);
        if (!logsContainer) return;

        const logWrappers = logsContainer.querySelectorAll('.log-entry-wrapper');
        logWrappers.forEach(wrapper => {
            const detailsDiv = wrapper.querySelector('.log-details');
            const arrowSpan = wrapper.querySelector('.arrow-indicator');
            if (detailsDiv && arrowSpan && arrowSpan.style.visibility !== 'hidden') {
                if (expand) {
                    detailsDiv.classList.remove('hidden');
                    arrowSpan.textContent = '▼';
                } else {
                    detailsDiv.classList.add('hidden');
                    arrowSpan.textContent = '▶';
                }
            }
        });
    }

    // Create columns for each service and set up SSE
    services.forEach(serviceName => {
        const columnDiv = document.createElement('div');
        columnDiv.className = 'flex flex-col min-h-0';
        columnDiv.id = `log-column-${serviceName}`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex justify-between items-center mb-2';

        const titleElement = document.createElement('h2');
        titleElement.className = 'text-lg font-semibold capitalize';

        const dbCountSpan = document.createElement('span');
        dbCountSpan.id = `db-count-${serviceName}`;
        dbCountSpan.textContent = '...';
        dbCountSpan.className = 'mr-2 text-sm text-gray-500';

        titleElement.appendChild(dbCountSpan);
        titleElement.appendChild(document.createTextNode(`${serviceName} Logs`));

        const logsContainer = document.createElement('div');
        logsContainer.id = `logs-container-${serviceName}`;
        logsContainer.className = 'logs-container flex-grow overflow-y-auto border border-gray-300 rounded p-2 bg-white min-h-0';
        logsContainer.innerHTML = '<p class="text-gray-500">Connecting to log stream...</p>';

        const displayedCountElement = document.createElement('div');
        displayedCountElement.id = `displayed-count-${serviceName}`;
        displayedCountElement.className = 'text-xs text-gray-500 mt-1 ml-1';
        displayedCountElement.textContent = 'Displayed: 0';

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'flex items-center space-x-1';

        const expandAllButton = document.createElement('button');
        expandAllButton.className = 'text-xs text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-300';
        expandAllButton.innerHTML = '▼';
        expandAllButton.title = `Expand all ${serviceName} logs`;
        expandAllButton.onclick = () => toggleAllLogDetails(serviceName, true);

        const collapseAllButton = document.createElement('button');
        collapseAllButton.className = 'text-xs text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-300';
        collapseAllButton.innerHTML = '▶';
        collapseAllButton.title = `Collapse all ${serviceName} logs`;
        collapseAllButton.onclick = () => toggleAllLogDetails(serviceName, false);

        const clearButton = document.createElement('button');
        clearButton.className = 'text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-300';
        clearButton.innerHTML = '&#x1F5D1;&#xFE0F;';
        clearButton.title = `Clear ${serviceName} logs`;
        clearButton.onclick = () => clearLogs(serviceName, logsContainer);

        const copyButton = document.createElement('button');
        copyButton.className = 'text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300';
        copyButton.innerHTML = '&#x1F4CB;';
        copyButton.title = 'Copy last 100 logs';
        copyButton.onclick = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/logs?service=${serviceName}`);
                if (!response.ok) {
                    alert(`Error fetching logs for copy: ${response.statusText}`);
                    return;
                }
                const logs = await response.json();
                const last100Logs = logs.slice(-100);

                const formattedLogs = last100Logs.map(log => {
                    let logString = `${formatTimestamp(log.timestamp)} [${log.level.toUpperCase()}] ${log.message}`;
                    if (log.details) {
                        const detailsString = typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2);
                        logString += `\n  Details: ${detailsString.replace(/\n/g, '\n  ')}`;
                    }
                    return logString;
                }).join('\n\n');

                if (formattedLogs) {
                    await navigator.clipboard.writeText(formattedLogs);
                    const originalIcon = copyButton.innerHTML;
                    copyButton.innerHTML = '&#x2714;';
                    setTimeout(() => {
                        copyButton.innerHTML = '&#x1F4CB;';
                    }, 1500);
                } else {
                    alert('No logs to copy.');
                }
            } catch (error) {
                console.error(`Error copying logs for ${serviceName}:`, error);
                alert('Failed to copy logs.');
            }
        };

        buttonGroup.appendChild(expandAllButton);
        buttonGroup.appendChild(collapseAllButton);
        buttonGroup.appendChild(copyButton);
        buttonGroup.appendChild(clearButton);

        headerDiv.appendChild(titleElement);
        headerDiv.appendChild(buttonGroup);

        columnDiv.appendChild(headerDiv);
        columnDiv.appendChild(logsContainer);
        columnDiv.appendChild(displayedCountElement);
        logColumnsContainer.appendChild(columnDiv);
        fetchAndUpdateDbCount(serviceName);

        // Setup SSE
        const eventSource = new EventSource(`${API_BASE_URL}/stream/${serviceName}`);
        let initialLogsProcessed = false;

        eventSource.addEventListener('initial_log', function(event) {
            if (!initialLogsProcessed) {
                logsContainer.innerHTML = '';
                initialLogsProcessed = true;
            }
            const logData = JSON.parse(event.data);
            appendLogToContainer(logData, logsContainer, serviceName);
            // DB count in title is fetched on load and after clear.
        });

        eventSource.addEventListener('new_log', function(event) {
            if (!initialLogsProcessed) {
                logsContainer.innerHTML = '';
                initialLogsProcessed = true;
            }
            const logData = JSON.parse(event.data);
            appendLogToContainer(logData, logsContainer, serviceName);
            fetchAndUpdateDbCount(serviceName); // Update DB count in title with each new log
        });

        eventSource.onerror = function(err) {
            console.error(`EventSource failed for ${serviceName}:`, err);
            logsContainer.innerHTML = '<p class="text-red-500">Error connecting to log stream. Retrying...</p>';
            // EventSource will attempt to reconnect automatically.
        };
    });

    // Adjust grid columns based on the number of services
    if (services.length > 0) {
        logColumnsContainer.classList.add(`grid-cols-${services.length > 2 ? 2 : services.length}`);
        logColumnsContainer.classList.add('gap-2');
    }
});
