// =========================================
// LILONGWE SCHOOL MAPPING SYSTEM
// LEAFLET VERSION WITH LOGGING + LOADING
// =========================================
let map;
let schoolMarkers = [];

// State
let searchLocation = null;
let searchLocationMarker = null;
let radiusCircle = null;
let selectedSchool = null;
let currentRoute = null;

const MILES_TO_METERS = 1609.34;
const LILONGWE = [-13.9626, 33.7741];

// =========================================
// LOGGING UTILITY
// =========================================
function logStep(step, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${step}`, data || "");
}

function logError(step, error) {
    const timestamp = new Date().toLocaleTimeString();
    console.error(`[${timestamp}] ERROR: ${step}`, error);
}

function logSuccess(step, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ✓ ${step}`, data || "");
}

// =========================================
// LOADING INDICATOR
// =========================================
function showLoading(message = "Loading...") {
    logStep("SHOW_LOADING", message);
    const loader = document.getElementById("loadingIndicator");
    if (loader) {
        document.getElementById("loadingMessage").textContent = message;
        loader.classList.remove("d-none");
    }
}

function hideLoading() {
    logStep("HIDE_LOADING");
    const loader = document.getElementById("loadingIndicator");
    if (loader) {
        loader.classList.add("d-none");
    }
}

// =========================================
// INITIALIZE MAP
// =========================================
function initMap() {
    logStep("INIT_MAP", "Creating Leaflet map");

    map = L.map('map').setView(LILONGWE, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 10
    }).addTo(map);

    logSuccess("LEAFLET_MAP_CREATED");

    loadSchools();
    setupEventListeners();
    focusOnQueryParam();
}

// =========================================
// LOAD SCHOOL DATA
// =========================================
async function loadSchools() {
    logStep("LOAD_SCHOOLS", "Fetching schools.json");

    try {
        const response = await fetch("data/schools.json");
        const schools = await response.json();
        logSuccess("SCHOOLS_LOADED", `${schools.length} schools fetched`);

        document.getElementById("totalSchools").textContent = schools.length;
        document.getElementById("visibleSchools").textContent = schools.length;

        schools.forEach((school, idx) => {
            addSchoolMarker(school);
            if ((idx + 1) % 50 === 0) {
                logStep("PROGRESS", `Added ${idx + 1}/${schools.length} markers`);
            }
        });

        logSuccess("ALL_MARKERS_ADDED");
    } catch (error) {
        logError("LOAD_SCHOOLS", error);
    }
}

// =========================================
// IF OPENED FROM "VIEW ON MAP" WITH QUERY PARAMS
// =========================================
function focusOnQueryParam() {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get("lat"));
    const lng = parseFloat(params.get("lng"));
    const name = params.get("name");

    if (!isNaN(lat) && !isNaN(lng)) {
        logStep("FOCUS_QUERY_PARAM", `lat=${lat}, lng=${lng}, name=${name}`);
        map.setView([lat, lng], 17);

        if (name) {
            const found = schoolMarkers.find(item => item.school.name === name);
            if (found) {
                found.marker.openPopup();
                logSuccess("OPENED_MARKER", name);
            }
        }
    }
}

// =========================================
// GET MARKER COLOR BY OWNERSHIP + LEVEL
// =========================================
function getMarkerColor(school) {
    const ownership = (school.ownership || "").trim().toLowerCase();
    const level = (school.level || "").trim().toLowerCase();

    const isPrivate = ownership === "private";
    const isPrimary = level.includes("primary");

    if (isPrivate && isPrimary) return "blue";
    if (isPrivate && !isPrimary) return "red";
    if (!isPrivate && isPrimary) return "orange";
    return "yellow";
}

// =========================================
// CREATE CUSTOM ICON
// =========================================
function createMarkerIcon(color) {
    const colorMap = {
        blue: "#0d6efd",
        red: "#dc3545",
        orange: "#fd7e14",
        yellow: "#ffc107"
    };

    const hexColor = colorMap[color] || "#6c757d";

    return L.divIcon({
        html: `<div style="
            background-color: ${hexColor};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        className: "leaflet-div-icon-school"
    });
}

// =========================================
// ADD SCHOOL MARKER
// =========================================
function addSchoolMarker(school) {
    const idx = schoolMarkers.length;
    const latlng = [Number(school.latitude), Number(school.longitude)];
    const color = getMarkerColor(school);

    const marker = L.marker(latlng, {
        icon: createMarkerIcon(color),
        title: school.name
    }).addTo(map);

    const popupContent = buildPopupContent(school, idx);
    marker.bindPopup(popupContent);

    marker.on('popupopen', function () {
        logStep("MARKER_POPUP_OPEN", school.name);
        setTimeout(() => {
            const btn = document.getElementById(`directionsBtn-${idx}`);
            if (btn) {
                btn.addEventListener('click', function () {
                    logStep("DIRECTIONS_REQUESTED", school.name);
                    marker.closePopup();
                    if (!searchLocation) {
                        alert("Please search a location first (or click \"My Location\"), then request directions.");
                        return;
                    }
                    showRoute(school, marker);
                });
            }
        }, 100);
    });

    schoolMarkers.push({
        marker: marker,
        school: school
    });
}

// =========================================
// BUILD POPUP CONTENT
// =========================================
function buildPopupContent(school, idx) {
    return `
        <div style="min-width:220px">
            <h6 class="fw-bold">${school.name}</h6>
            <hr>
            <p class="mb-1"><strong>Level:</strong> ${school.level}</p>
            <p class="mb-1"><strong>Ownership:</strong> ${school.ownership}</p>
            <p class="mb-1"><strong>Type:</strong> ${school.type}</p>
            <p class="mb-2"><strong>Coordinates:</strong><br>${school.latitude}, ${school.longitude}</p>
            <button id="directionsBtn-${idx}" class="btn btn-sm btn-primary w-100">
                <i class="bi bi-signpost-2"></i> Directions
            </button>
        </div>
    `;
}

// =========================================
// EVENT LISTENERS
// =========================================
function setupEventListeners() {
    logStep("SETUP_EVENT_LISTENERS");

    document.getElementById("locationSearchBtn")
        .addEventListener("click", handleLocationSearch);

    document.getElementById("locationButton")
        .addEventListener("click", handleMyLocation);

    document.getElementById("nearestButton")
        .addEventListener("click", findNearestSchool);

    document.getElementById("radiusSelect")
        .addEventListener("change", renderNearbySchools);

    document.getElementById("schoolSearch")
        .addEventListener("input", filterSchoolMarkers);

    document.getElementById("schoolLevel")
        .addEventListener("change", filterSchoolMarkers);

    document.getElementById("ownership")
        .addEventListener("change", filterSchoolMarkers);

    document.getElementById("closeDirectionsBtn")
        .addEventListener("click", closeDirectionsPanel);

    logSuccess("EVENT_LISTENERS_READY");
}

// =========================================
// HAVERSINE DISTANCE (miles)
// =========================================
function haversineMiles(lat1, lon1, lat2, lon2) {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// =========================================
// GEOCODE ADDRESS (Nominatim)
// =========================================
async function geocodeAddress(query) {
    logStep("GEOCODING", `Query: "${query}"`);
    showLoading(`Searching for "${query}"...`);

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        logStep("NOMINATIM_REQUEST", url);

        const response = await fetch(url);
        const data = await response.json();

        if (data.length > 0) {
            const result = data[0];
            logSuccess("GEOCODING_SUCCESS", {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                label: result.display_name
            });

            hideLoading();
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                label: result.display_name
            };
        }

        logError("GEOCODING", "No results found");
        hideLoading();
        return null;
    } catch (error) {
        logError("GEOCODING", error);
        hideLoading();
        return null;
    }
}

// =========================================
// HANDLE LOCATION SEARCH
// =========================================
async function handleLocationSearch() {
    const input = document.getElementById("locationSearchInput").value.trim();

    logStep("LOCATION_SEARCH_CLICKED", `Input: "${input}"`);

    if (!input) {
        alert("Please enter an address or place.");
        logError("LOCATION_SEARCH", "Input was empty");
        return;
    }

    const result = await geocodeAddress(input);
    if (result) {
        setSearchLocation(result.lat, result.lng, result.label);
        document.getElementById("locationSearchInput").value = result.label;
        renderNearbySchools();
    } else {
        alert("Could not find location: " + input);
        logError("LOCATION_SEARCH", "Geocoding failed");
    }
}

// =========================================
// HANDLE MY LOCATION
// =========================================
function handleMyLocation() {
    logStep("MY_LOCATION_CLICKED");

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        logError("MY_LOCATION", "Geolocation not supported");
        return;
    }

    showLoading("Getting your location...");
    logStep("GEOLOCATION_REQUEST", "Requesting user location");

    navigator.geolocation.getCurrentPosition(function (position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        logSuccess("GEOLOCATION_SUCCESS", {
            lat: lat,
            lng: lng,
            accuracy: `${accuracy}m`
        });

        setSearchLocation(lat, lng, "My Current Location");
        document.getElementById("locationSearchInput").value = "My Current Location";
        hideLoading();
        renderNearbySchools();
    }, handleGeolocationError, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000
    });
}

// =========================================
// SET SEARCH LOCATION
// =========================================
function setSearchLocation(lat, lng, label) {
    logStep("SET_SEARCH_LOCATION", { lat, lng, label });

    searchLocation = { lat, lng, label };

    if (searchLocationMarker) {
        map.removeLayer(searchLocationMarker);
    }

    searchLocationMarker = L.marker([lat, lng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        }),
        title: label
    }).addTo(map);

    const radiusMiles = parseFloat(document.getElementById("radiusSelect").value);
    drawRadiusCircle(radiusMiles);

    logSuccess("SEARCH_LOCATION_SET");
}

// =========================================
// DRAW RADIUS CIRCLE
// =========================================
function drawRadiusCircle(radiusMiles) {
    logStep("DRAW_RADIUS_CIRCLE", `${radiusMiles} miles`);

    if (radiusCircle) {
        map.removeLayer(radiusCircle);
    }

    if (searchLocationMarker) {
        radiusCircle = L.circle(searchLocationMarker.getLatLng(), {
            radius: radiusMiles * MILES_TO_METERS,
            color: "#0d6efd",
            weight: 1,
            opacity: 0.6,
            fillColor: "#0d6efd",
            fillOpacity: 0.08
        }).addTo(map);

        logSuccess("RADIUS_CIRCLE_DRAWN");
    }
}

// =========================================
// QUERY OSRM FOR ROUTE DISTANCE
// =========================================
async function getRouteDistance(lat1, lng1, lat2, lng2, schoolName) {
    const distanceHaversine = haversineMiles(lat1, lng1, lat2, lng2);
    logStep("ROUTE_QUERY", `${schoolName} (haversine: ${distanceHaversine.toFixed(2)} miles)`);

    // Warn if distance is very large
    if (distanceHaversine > 100) {
        logStep("WARNING", `School ${schoolName} is ${distanceHaversine.toFixed(2)} miles away. Routing may be slow.`);
    }

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
        logStep("OSRM_REQUEST", url);

        const response = await fetch(url);
        const data = await response.json();

        logStep("OSRM_RAW_RESPONSE", { code: data.code, routeCount: data.routes?.length || 0 });

        if (data.code !== 'Ok') {
            logError("OSRM_RESPONSE", `Code: ${data.code}, Message: ${data.message}`);
            return null;
        }

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distanceMeters = route.distance;
            const distanceMiles = distanceMeters / MILES_TO_METERS;
            const durationSeconds = route.duration;
            const durationText = formatDuration(durationSeconds);

            logStep("OSRM_GEOMETRY_CHECK", {
                hasGeometry: !!route.geometry,
                geometryType: typeof route.geometry,
                hasCoordinates: !!route.geometry?.coordinates,
                coordinatesLength: route.geometry?.coordinates?.length || 0
            });

            logSuccess("ROUTE_CALCULATED", {
                school: schoolName,
                distance: `${distanceMiles.toFixed(2)} miles`,
                duration: durationText,
                hasGeometry: !!route.geometry,
                hasCoordinates: !!route.geometry?.coordinates
            });

            return {
                distance: distanceMiles,
                duration: durationText,
                geometry: route.geometry
            };
        }

        logError("OSRM_RESPONSE", "No routes in response");
        return null;
    } catch (error) {
        logError("OSRM_ROUTING", error);
        return null;
    }
}

// =========================================
// FORMAT DURATION
// =========================================
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// =========================================
// RENDER NEARBY SCHOOLS
// =========================================
async function renderNearbySchools() {
    logStep("RENDER_NEARBY_SCHOOLS");

    if (!searchLocation) {
        document.getElementById("nearbySchoolsResults").innerHTML = `
            <p class="text-muted small">
                Search an address or use "My Location" to find nearby schools.
            </p>
        `;
        logStep("NO_SEARCH_LOCATION");
        return;
    }

    const radiusMiles = parseFloat(document.getElementById("radiusSelect").value);
    showLoading(`Finding schools within ${radiusMiles} miles...`);

    logStep("FILTER_BY_HAVERSINE", `Radius: ${radiusMiles} miles, Total schools: ${schoolMarkers.length}`);

    const candidatesByHaversine = schoolMarkers
        .map(function (item) {
            const distance = haversineMiles(
                searchLocation.lat, searchLocation.lng,
                Number(item.school.latitude),
                Number(item.school.longitude)
            );
            return { item, distance };
        })
        .filter(cand => cand.distance <= radiusMiles)
        .sort((a, b) => a.distance - b.distance);

    logSuccess("HAVERSINE_FILTERED", `${candidatesByHaversine.length} schools within radius`);

    if (candidatesByHaversine.length === 0) {
        document.getElementById("nearbySchoolsResults").innerHTML = `
            <p class="text-muted small">
                No schools found within ${radiusMiles} miles.
            </p>
        `;
        document.getElementById("nearbyResultsHeader").textContent = "";
        fitMapToResults([]);
        hideLoading();
        logStep("NO_RESULTS");
        return;
    }

    showLoading(`Calculating routes for ${candidatesByHaversine.length} schools (in parallel)...`);

    // Query all routes in PARALLEL
    const routePromises = candidatesByHaversine.map(cand =>
        getRouteDistance(
            searchLocation.lat, searchLocation.lng,
            Number(cand.item.school.latitude),
            Number(cand.item.school.longitude),
            cand.item.school.name
        ).then(route => {
            if (route && route.geometry) {
                return {
                    item: cand.item,
                    distance: route.distance,
                    duration: route.duration,
                    geometry: route.geometry
                };
            }
            return null;
        }).catch(error => {
            logError("ROUTE_QUERY_FAILED", `${cand.item.school.name}: ${error.message}`);
            return null;
        })
    );

    const routeResults = (await Promise.all(routePromises)).filter(r => r !== null);

    logSuccess("ALL_ROUTES_QUERIED_PARALLEL", `${routeResults.length} valid routes`);

    routeResults.sort((a, b) => a.distance - b.distance);
    logSuccess("ALL_ROUTES_CALCULATED", `${routeResults.length} valid routes`);

    renderNearbySchoolsList(routeResults, radiusMiles);
    fitMapToResults(routeResults.map(r => r.item));
    hideLoading();
}

// =========================================
// RENDER NEARBY SCHOOLS LIST
// =========================================
function renderNearbySchoolsList(routeResults, radiusMiles) {
    logStep("RENDER_LIST", `Displaying ${routeResults.length} schools`);

    const container = document.getElementById("nearbySchoolsResults");
    const header = document.getElementById("nearbyResultsHeader");

    header.textContent = `${routeResults.length} schools within ${radiusMiles} miles`;

    container.innerHTML = routeResults.map(function (result, idx) {
        const item = result.item;
        const distance = result.distance.toFixed(2);
        const duration = result.duration;

        return `
            <div class="nearby-school-item" data-idx="${schoolMarkers.indexOf(item)}">
                <div class="fw-bold">${item.school.name}</div>
                <div class="small text-muted">
                    ${distance} miles | ${duration}
                </div>
                <div class="small">
                    <span class="badge bg-light text-dark">${item.school.level}</span>
                    <span class="badge ${item.school.ownership === "Private" ? "bg-info" : "bg-secondary"}">
                        ${item.school.ownership}
                    </span>
                </div>
            </div>
        `;
    }).join("");

    container.querySelectorAll(".nearby-school-item").forEach(function (el) {
        el.addEventListener("click", function () {
            const idx = parseInt(this.dataset.idx, 10);
            const item = schoolMarkers[idx];

            logStep("SCHOOL_SELECTED", item.school.name);
            showRoute(item.school, item.marker);

            container.querySelectorAll(".nearby-school-item")
                .forEach(x => x.classList.remove("active"));
            this.classList.add("active");
        });
    });

    logSuccess("LIST_RENDERED");
}

// =========================================
// FIT MAP TO RESULTS
// =========================================
function fitMapToResults(nearby) {
    logStep("FIT_MAP", `${nearby.length} results`);

    const bounds = L.latLngBounds([searchLocationMarker.getLatLng()]);

    nearby.forEach(item => bounds.extend(item.marker.getLatLng()));

    if (nearby.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        map.setView(searchLocationMarker.getLatLng(), 14);
    }

    logSuccess("MAP_FITTED");
}

// =========================================
// FIND NEAREST SCHOOL
// =========================================
async function findNearestSchool() {
    logStep("FIND_NEAREST_CLICKED");

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        logError("FIND_NEAREST", "Geolocation not supported");
        return;
    }

    if (schoolMarkers.length === 0) {
        alert("School data has not loaded yet.");
        logError("FIND_NEAREST", "No schools loaded");
        return;
    }

    showLoading("Getting your location...");

    navigator.geolocation.getCurrentPosition(async function (position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        logSuccess("LOCATION_ACQUIRED", { lat, lng });

        setSearchLocation(lat, lng, "My Current Location");
        document.getElementById("locationSearchInput").value = "My Current Location";

        showLoading("Finding nearest school (querying top 5 candidates in parallel)...");

        const candidatesWithHaversine = schoolMarkers.map(function (item) {
            const distance = haversineMiles(
                lat, lng,
                Number(item.school.latitude),
                Number(item.school.longitude)
            );
            return { item, distance };
        });

        candidatesWithHaversine.sort((a, b) => a.distance - b.distance);
        const topCandidates = candidatesWithHaversine.slice(0, 5);

        logSuccess("TOP_5_FILTERED", topCandidates.map(c => `${c.item.school.name} (${c.distance.toFixed(2)} mi)`));

        // Query routes in PARALLEL instead of sequential
        showLoading("Querying OSRM for all 5 candidates (in parallel)...");
        const routePromises = topCandidates.map(cand =>
            getRouteDistance(
                lat, lng,
                Number(cand.item.school.latitude),
                Number(cand.item.school.longitude),
                cand.item.school.name
            ).then(route => {
                if (route && route.geometry) {
                    return {
                        item: cand.item,
                        distance: route.distance,
                        duration: route.duration,
                        geometry: route.geometry
                    };
                }
                return null;
            }).catch(error => {
                logError("ROUTE_QUERY_FAILED", `${cand.item.school.name}: ${error.message}`);
                return null;
            })
        );

        const routeResults = (await Promise.all(routePromises)).filter(r => r !== null);

        logSuccess("ALL_ROUTES_QUERIED_PARALLEL", `${routeResults.length} valid routes`);

        routeResults.sort((a, b) => a.distance - b.distance);

        if (routeResults.length > 0) {
            const nearest = routeResults[0];
            logSuccess("NEAREST_FOUND", `${nearest.item.school.name} (${nearest.distance.toFixed(2)} miles)`);

            showRoute(nearest.item.school, nearest.item.marker);

            const radiusSelect = document.getElementById("radiusSelect");
            const currentRadius = parseFloat(radiusSelect.value);
            if (nearest.distance > currentRadius) {
                const options = Array.from(radiusSelect.options).map(o => parseFloat(o.value));
                const fitting = options.find(v => v >= nearest.distance);
                radiusSelect.value = fitting || options[options.length - 1];
            }

            hideLoading();
        } else {
            logError("FIND_NEAREST", "No valid routes found");
            hideLoading();
        }
    }, handleGeolocationError, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000
    });
}

// =========================================
// SHOW ROUTE TO SCHOOL
// =========================================
async function showRoute(school, marker) {
    logStep("SHOW_ROUTE", school.name);

    if (!searchLocation) {
        alert("Please search a location first.");
        logError("SHOW_ROUTE", "No search location set");
        return;
    }

    showLoading(`Calculating route to ${school.name}...`);

    const route = await getRouteDistance(
        searchLocation.lat, searchLocation.lng,
        Number(school.latitude),
        Number(school.longitude),
        school.name
    );

    if (!route) {
        alert("Could not calculate route to this school.");
        hideLoading();
        logError("SHOW_ROUTE", "Route calculation failed");
        return;
    }

    if (!route.geometry) {
        alert("Route geometry not available.");
        hideLoading();
        logError("SHOW_ROUTE", "No geometry in route");
        return;
    }

    if (!route.geometry.coordinates || !Array.isArray(route.geometry.coordinates)) {
        alert("Route coordinates not available.");
        hideLoading();
        logError("SHOW_ROUTE", "Coordinates missing or invalid", route.geometry);
        return;
    }

    if (route.geometry.coordinates.length === 0) {
        alert("Route has no coordinate data.");
        hideLoading();
        logError("SHOW_ROUTE", "Empty coordinates array");
        return;
    }

    if (currentRoute) {
        map.removeLayer(currentRoute);
    }

    try {
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        currentRoute = L.polyline(coords, {
            color: '#0d6efd',
            weight: 5,
            opacity: 0.8
        }).addTo(map);

        map.fitBounds(currentRoute.getBounds(), { padding: [50, 50] });

        renderDirectionsPanel(school, route);
        hideLoading();
        logSuccess("ROUTE_DISPLAYED");
    } catch (error) {
        logError("SHOW_ROUTE_GEOMETRY", error);
        hideLoading();
        alert("Error drawing route on map.");
    }
}

// =========================================
// RENDER DIRECTIONS PANEL
// =========================================
function renderDirectionsPanel(school, route) {
    logStep("RENDER_DIRECTIONS", school.name);

    const panel = document.getElementById("directionsPanel");
    const title = document.getElementById("directionsTitle");
    const list = document.getElementById("routeOptionsList");

    title.innerHTML = `
        <div class="text-muted">${searchLocation.label}</div>
        <div class="text-center"><i class="bi bi-arrow-down"></i></div>
        <div class="fw-bold">${school.name}</div>
    `;

    list.innerHTML = `
        <div class="route-option active">
            <div class="d-flex justify-content-between">
                <span class="fw-bold">${route.duration}</span>
                <span class="text-muted">${route.distance.toFixed(2)} miles</span>
            </div>
            <div class="small text-muted">
                via OSRM Routing (OpenStreetMap)
            </div>
        </div>
    `;

    panel.classList.remove("d-none");
    logSuccess("DIRECTIONS_PANEL_SHOWN");
}

// =========================================
// CLOSE DIRECTIONS PANEL
// =========================================
function closeDirectionsPanel() {
    logStep("CLOSE_DIRECTIONS_PANEL");

    document.getElementById("directionsPanel").classList.add("d-none");
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }
    selectedSchool = null;

    logSuccess("DIRECTIONS_PANEL_CLOSED");
}

// =========================================
// FILTER SCHOOL MARKERS
// =========================================
function filterSchoolMarkers() {
    const query = document.getElementById("schoolSearch").value.trim().toLowerCase();
    const levelFilter = document.getElementById("schoolLevel").value;
    const ownershipFilter = document.getElementById("ownership").value;

    logStep("FILTER_MARKERS", { query, levelFilter, ownershipFilter });

    let visibleCount = 0;

    schoolMarkers.forEach(function (item) {
        const school = item.school;

        const nameMatches = !query || school.name.toLowerCase().includes(query);

        const levelValue = (school.level || "").toLowerCase();
        const levelMatches =
            levelFilter === "all" ||
            (levelFilter === "primary" && levelValue.includes("primary")) ||
            (levelFilter === "secondary" && levelValue.includes("secondary"));

        const ownershipValue = (school.ownership || "").toLowerCase();
        const ownershipMatches =
            ownershipFilter === "all" || ownershipValue === ownershipFilter;

        const shouldShow = nameMatches && levelMatches && ownershipMatches;

        if (shouldShow) {
            item.marker.setOpacity(1);
            visibleCount++;
        } else {
            item.marker.setOpacity(0.3);
        }
    });

    document.getElementById("visibleSchools").textContent = visibleCount;
    logSuccess("MARKERS_FILTERED", `${visibleCount} visible`);
}

// =========================================
// HANDLE GEOLOCATION ERROR
// =========================================
function handleGeolocationError(error) {
    hideLoading();
    let message = "Geolocation error.";
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = "Geolocation permission denied. Enable location access in your browser.";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Location unavailable. Try again or enter an address.";
            break;
        case error.TIMEOUT:
            message = "Location request timed out. Try again.";
            break;
    }
    alert(message);
    logError("GEOLOCATION", `${error.code}: ${message}`);
}

// =========================================
// INITIALIZE ON PAGE LOAD
// =========================================
document.addEventListener("DOMContentLoaded", function () {
    logStep("PAGE_LOAD", "DOMContentLoaded fired");
    initMap();
    logSuccess("SYSTEM_READY");
});