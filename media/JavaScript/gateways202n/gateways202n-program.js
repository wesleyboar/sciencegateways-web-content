'use strict';

const JSON_FILE_NAME = window.GATEWAYS_JSON_FILE_NAME || '2026_CONFERENCE_SCHEDULE.txt';
const JSON_URL = `${window.location.origin}/app/site/media/files/gateways202n/${JSON_FILE_NAME}`;

const scheduleElement =
document.getElementById("schedule");

const typeFilterElement =
document.getElementById("schedule-type-filter");

const dateFilterElement =
document.getElementById("schedule-date-filter");

const searchElement =
document.getElementById("schedule-search");

const clearFiltersElement =
document.getElementById("schedule-clear-filters");


function escapeHtml(value) {
return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('\"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDescription(text) {
if (!text) return "";

let formatted = escapeHtml(text);

// [link text](https://example.com) becomes a hyperlink
formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a class="description-link" data-url="$2" target="_blank" rel="noopener noreferrer">$1</a>'
);

// **text** becomes bold
formatted = formatted.replace(
    /\*\*(.*?)\*\*/g,
    "<strong>$1</strong>"
);

// Blank line becomes a new paragraph
formatted = formatted.replace(
    /\n\s*\n/g,
    "</p><p>"
);

// Single line break becomes <br>
formatted = formatted.replace(
    /\n/g,
    "<br>"
);

return `<p>${formatted}</p>`;
}

function cleanExternalUrl(value) {
const text = String(value ?? "").trim();

if (!text) {
    return "";
}

const markdownMatch =
    text.match(/\]\((https?:\/\/[^)\s]+)\)/i);

if (markdownMatch) {
    return markdownMatch[1];
}

const urlMatch =
    text.match(/https?:\/\/[^\s\])]+/i);

return urlMatch ? urlMatch[0] : "";
}

function parseBoolean(value) {
return ["true", "yes", "1"].includes(
    String(value ?? "")
    .trim()
    .toLowerCase()
);
}


function hasEventContent(event) {
return Boolean(
    event.title ||
    event.session_title ||
    event.description
);
}

function timeToMinutes(timeValue) {
if (!timeValue) {
    return Number.MAX_SAFE_INTEGER;
}

const match = String(timeValue)
    .trim()
    .match(
    /^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i
    );

if (!match) {
    return Number.MAX_SAFE_INTEGER;
}

let hours = Number(match[1]);
const minutes = Number(match[2]);
const period =
    match[3]?.toUpperCase();

if (
    period === "AM" &&
    hours === 12
) {
    hours = 0;
}

if (
    period === "PM" &&
    hours !== 12
) {
    hours += 12;
}

return hours * 60 + minutes;
}

function parseDate(dateValue) {
const match = String(dateValue ?? "")
    .match(
    /^(\d{4})-(\d{2})-(\d{2})$/
    );

if (!match) {
    return null;
}

return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
);
}

function dateSortValue(dateValue) {
const date = parseDate(dateValue);

return date
    ? date.getTime()
    : Number.MAX_SAFE_INTEGER;
}

function formatDate(dateValue) {
const date = parseDate(dateValue);

if (!date) {
    return escapeHtml(
    dateValue ||
    "Date to be announced"
    );
}

return new Intl.DateTimeFormat(
    "en-US",
    {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
    }
).format(date);
}

function formatTimeRange(start, end) {
if (start && end) {
    return (
    `${escapeHtml(start)}` +
    `–${escapeHtml(end)}`
    );
}

return escapeHtml(
    start ||
    end ||
    ""
);
}

function makeTypeClass(type) {
return String(type ?? "")
    .trim()
    .toLowerCase()
    .replace(
    /[^a-z0-9]+/g,
    "-"
    )
    .replace(
    /^-|-$/g,
    ""
    );
}

function populateTypeFilter(events) {
const visibleEvents = events
    .filter(hasEventContent)
    .filter(
    (event) =>
        parseBoolean(event.visible)
    );

const types = [
    ...new Set(
    visibleEvents
        .map(
        (event) =>
            event.type.trim()
        )
        .filter(Boolean)
    )
].sort(
    (typeA, typeB) =>
    typeA.localeCompare(typeB)
);

typeFilterElement.innerHTML = `
    <option value="all">
    All event types
    </option>

    ${types
    .map((type) => {
        const typeValue =
        makeTypeClass(type);

        return `
        <option
            value="${escapeHtml(typeValue)}"
        >
            ${escapeHtml(type)}
        </option>
        `;
    })
    .join("")}
`;
}

function populateDateFilter(events) {
const visibleEvents = events
    .filter(hasEventContent)
    .filter(
    (event) =>
        parseBoolean(event.visible)
    );

const dates = [
    ...new Set(
    visibleEvents
        .map((event) => event.date)
        .filter(Boolean)
    )
].sort(
    (dateA, dateB) =>
    dateSortValue(dateA) -
    dateSortValue(dateB)
);

dateFilterElement.innerHTML = `
    <option value="all">
    All dates
    </option>

    ${dates
    .map((date) => `
        <option value="${escapeHtml(date)}">
        ${formatDate(date)}
        </option>
    `)
    .join("")}
`;
}

function matchesSearch(event, searchTerm) {
if (!searchTerm) {
    return true;
}

const searchableText = [
    event.title,
    event.speakers,
    event.description,
    event.session_title,
    event.location,
    event.format,
    event.type
]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

return searchableText.includes(searchTerm);
}

function groupEvents(events) {
const dates = new Map();

events.forEach((event) => {
    const dateKey =
    event.date ||
    "Date to be announced";

    const sessionKey = [
    event.session_title ||
        "Program",
    event.session_start_time,
    event.session_end_time
    ].join("|");

    if (!dates.has(dateKey)) {
    dates.set(
        dateKey,
        new Map()
    );
    }

    const sessions =
    dates.get(dateKey);

    if (!sessions.has(sessionKey)) {
    sessions.set(
        sessionKey,
        {
        title:
            event.session_title ||
            "Program",
        start:
            event.session_start_time,
        end:
            event.session_end_time,
        events: []
        }
    );
    }

    sessions
    .get(sessionKey)
    .events
    .push(event);
});

return dates;
}

function renderTags(event) {
const tags = [];

if (event.type) {
    const typeClass =
    makeTypeClass(event.type);

    tags.push(`
    <span
        class="schedule-tag type-${escapeHtml(typeClass)}"
    >
        ${escapeHtml(event.type)}
    </span>
    `);
}

if (event.format) {
    tags.push(`
    <span class="schedule-tag">
        ${escapeHtml(event.format)}
    </span>
    `);
}

if (!tags.length) {
    return "";
}

return `
    <div class="schedule-tags">
    ${tags.join("")}
    </div>
`;
}

function renderDetails(
event,
detailsId
) {
const meta = [];

if (event.location) {
    meta.push(`
    <div>
        <dt>Location</dt>
        <dd>
        ${escapeHtml(event.location)}
        </dd>
    </div>
    `);
}

if (event.format) {
    meta.push(`
    <div>
        <dt>Format</dt>
        <dd>
        ${escapeHtml(event.format)}
        </dd>
    </div>
    `);
}

if (event.timezone) {
    meta.push(`
    <div>
        <dt>Timezone</dt>
        <dd>
        ${escapeHtml(event.timezone)}
        </dd>
    </div>
    `);
}

const descriptionHtml =
    event.description
    ? `
        <div class="schedule-description">
        ${formatDescription(event.description)}
        </div>
    `
    : "";

const metaHtml =
    meta.length
    ? `
        <dl class="schedule-meta">
        ${meta.join("")}
        </dl>
    `
    : "";

const registrationUrl =
    cleanExternalUrl(event.registration_url);

const registrationHtml =
    registrationUrl
    ? `
        <a
        class="schedule-link"
        data-registration-url="${escapeHtml(registrationUrl)}"
        target="_blank"
        rel="noopener noreferrer"
        >
        Registration or event details
        </a>
    `
    : "";

return `
    <div
    class="schedule-event-details"
    id="${escapeHtml(detailsId)}"
    >
    ${descriptionHtml}
    ${metaHtml}
    ${registrationHtml}
    </div>
`;
}

function renderEvent(
event,
eventIndex
) {
const expandable =
    parseBoolean(event.expandable);

const typeClass =
    makeTypeClass(event.type) ||
    "default";

const detailsId =
    `schedule-details-${eventIndex}`;

const summaryContent = `
    <div class="schedule-event-time">
    ${formatTimeRange(
        event.event_start_time,
        event.event_end_time
    )}
    </div>

    <div class="schedule-event-main">
    <div class="schedule-event-title-row">
        <h4 class="schedule-event-title">
        ${escapeHtml(
            event.title ||
            "Untitled event"
        )}
        </h4>

        ${
        expandable
            ? `
            <span
                class="schedule-expand-icon"
                aria-hidden="true"
            >
                +
            </span>
            `
            : ""
        }
    </div>

    ${
        event.speakers
        ? `
            <div class="schedule-speakers">
            ${escapeHtml(event.speakers)}
            </div>
        `
        : ""
    }

    ${renderTags(event)}
    </div>
`;

const articleClasses =
    `schedule-event type-${typeClass}`;

if (!expandable) {
    return `
    <article
        class="${escapeHtml(articleClasses)}"
        data-event-type="${escapeHtml(typeClass)}"
    >
        <div class="schedule-event-summary">
        ${summaryContent}
        </div>
    </article>
    `;
}

return `
    <article
    class="${escapeHtml(articleClasses)}"
    data-event-type="${escapeHtml(typeClass)}"
    >
    <button
        class="schedule-event-summary"
        type="button"
        aria-expanded="false"
        aria-controls="${escapeHtml(detailsId)}"
    >
        ${summaryContent}
    </button>

    ${renderDetails(
        event,
        detailsId
    )}
    </article>
`;
}

function renderSchedule(
events,
selectedType = "all",
selectedDate = "all",
searchTerm = ""
) {
const normalizedSearch =
    String(searchTerm ?? "")
    .trim()
    .toLowerCase();

const visibleEvents = events
    .filter(hasEventContent)
    .filter(
    (event) =>
        parseBoolean(event.visible)
    )
    .filter((event) => {
    return (
        selectedType === "all" ||
        makeTypeClass(event.type) ===
        selectedType
    );
    })
    .filter((event) => {
    return (
        selectedDate === "all" ||
        event.date === selectedDate
    );
    })
    .filter((event) =>
    matchesSearch(event, normalizedSearch)
    );

if (!visibleEvents.length) {
    scheduleElement.innerHTML = `
    <div class="schedule-status">
        No events match the selected filters.
    </div>
    `;

    return;
}

const grouped =
    groupEvents(visibleEvents);

const dateEntries = [
    ...grouped.entries()
].sort(
    ([dateA], [dateB]) =>
    dateSortValue(dateA) -
    dateSortValue(dateB)
);

let eventIndex = 0;

scheduleElement.innerHTML =
    dateEntries
    .map(([date, sessions]) => {
        const sortedSessions = [
        ...sessions.values()
        ].sort(
        (
            sessionA,
            sessionB
        ) =>
            timeToMinutes(
            sessionA.start
            ) -
            timeToMinutes(
            sessionB.start
            )
        );

        const sessionHtml =
        sortedSessions
            .map((session) => {
            const sortedEvents =
                [...session.events].sort(
                (
                    eventA,
                    eventB
                ) =>
                    timeToMinutes(
                    eventA.event_start_time
                    ) -
                    timeToMinutes(
                    eventB.event_start_time
                    )
                );

            const eventsHtml =
                sortedEvents
                .map((event) => {
                    eventIndex += 1;

                    return renderEvent(
                    event,
                    eventIndex
                    );
                })
                .join("");

            return `
                <section class="schedule-session">
                <header
                    class="schedule-session-header"
                >
                    <h3
                    class="schedule-session-title"
                    >
                    ${escapeHtml(
                        session.title
                    )}
                    </h3>

                    <div
                    class="schedule-session-time"
                    >
                    ${formatTimeRange(
                        session.start,
                        session.end
                    )}
                    </div>
                </header>

                ${eventsHtml}
                </section>
            `;
            })
            .join("");

        return `
        <section class="schedule-day">
            <h2 class="schedule-date">
            ${formatDate(date)}
            </h2>

            ${sessionHtml}
        </section>
        `;
    })
    .join("");

attachRegistrationLinks();
attachDescriptionLinks();
attachExpandHandlers();
}

function attachDescriptionLinks() {
const links =
    scheduleElement.querySelectorAll(
    ".description-link[data-url]"
    );

links.forEach((link) => {
    const url =
    cleanExternalUrl(
        link.dataset.url
    );

    if (url) {
    link.href = url;
    }
});
}

function attachRegistrationLinks() {
const links =
    scheduleElement.querySelectorAll(
    ".schedule-link[data-registration-url]"
    );

links.forEach((link) => {
    const url =
    cleanExternalUrl(
        link.dataset.registrationUrl
    );

    if (url) {
    link.href = url;
    }
});
}

function attachExpandHandlers() {
const buttons =
    scheduleElement.querySelectorAll(
    "button.schedule-event-summary"
    );

buttons.forEach((button) => {
    button.addEventListener(
    "click",
    () => {
        const eventElement =
        button.closest(
            ".schedule-event"
        );

        if (!eventElement) {
        return;
        }

        const isOpen =
        eventElement.classList.toggle(
            "is-open"
        );

        button.setAttribute(
        "aria-expanded",
        String(isOpen)
        );
    }
    );
});
}

async function loadSchedule() {
if (
    !scheduleElement ||
    !typeFilterElement ||
    !dateFilterElement ||
    !searchElement ||
    !clearFiltersElement
) {
    throw new Error(
    "One or more schedule controls could not be found."
    );
}

const response =
    await fetch(
    JSON_URL,
    {
        cache: "no-store"
    }
    );

if (!response.ok) {
    let details = "";

    try {
    details =
        await response.text();
    } catch {
    details = "";
    }

    throw new Error(
    `Schedule JSON request failed (${response.status}). ${details}`
    );
}

const events =
    await response.json();

if (!Array.isArray(events)) {
    throw new Error(
    "The schedule JSON must contain an array of event objects."
    );
}

console.log(
    "Loaded JSON schedule events:",
    events
);

populateTypeFilter(events);
populateDateFilter(events);

const applyFilters = () => {
    renderSchedule(
    events,
    typeFilterElement.value,
    dateFilterElement.value,
    searchElement.value
    );
};

renderSchedule(events);

typeFilterElement.addEventListener(
    "change",
    applyFilters
);

dateFilterElement.addEventListener(
    "change",
    applyFilters
);

searchElement.addEventListener(
    "input",
    applyFilters
);

clearFiltersElement.addEventListener(
    "click",
    () => {
    typeFilterElement.value = "all";
    dateFilterElement.value = "all";
    searchElement.value = "";
    applyFilters();
    }
);
}

loadSchedule().catch((error) => {
console.error(error);

scheduleElement.innerHTML = `
    <div class="schedule-status error">
    <strong>
        The schedule could not be loaded.
    </strong>
    <br>
    ${escapeHtml(error.message)}
    </div>
`;
});