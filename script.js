/* =========================================================
   CODE GREEN 2026
   8th MIMAROPA Regional IT Congress
   Check-In Frontend
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const DEPLOYED_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbw6aqArIX_eXtrfBDe5_iiqX-97-Zfwbgt3K_P21P56jP0-0tjl8PjKf1o6cyESCwaqSw/exec";


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let html5QrCode = null;

let isProcessing = false;

let lastScannedCode = "";

let lastScanTime = 0;

const SCAN_COOLDOWN = 2500;


/* =========================================================
   DOM ELEMENTS
========================================================= */

const searchInput =
    document.getElementById("searchInput");

const submitBtn =
    document.getElementById("submitBtn");

const statusBox =
    document.getElementById("statusBox");

const resultTitle =
    document.getElementById("resultTitle");

const resultName =
    document.getElementById("resultName");

const resultTime =
    document.getElementById("resultTime");

const resultMessage =
    document.getElementById("resultMessage");

const bulkRegistrationInfo =
    document.getElementById("bulkRegistrationInfo");

const modalSchool =
    document.getElementById("modalSchool");

const modalHeadcount =
    document.getElementById("modalHeadcount");

const modalPaying =
    document.getElementById("modalPaying");

const modalFree =
    document.getElementById("modalFree");

const overrideButton =
    document.getElementById("overrideButton");

const overrideAttendeeId =
    document.getElementById("overrideAttendeeId");

const overridePin =
    document.getElementById("overridePin");

const confirmOverride =
    document.getElementById("confirmOverride");


/* =========================================================
   BOOT
========================================================= */

window.addEventListener("load", () => {

    initializeScanner();

    setupEvents();

});


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {

    if (submitBtn) {

        submitBtn.addEventListener(
            "click",
            submitManualId
        );

    }


    if (searchInput) {

        searchInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    submitManualId();

                }

            }
        );

    }


    if (overrideButton) {

        overrideButton.addEventListener(
            "click",
            openOverrideModal
        );

    }


    if (confirmOverride) {

        confirmOverride.addEventListener(
            "click",
            processManualOverride
        );

    }


    if (overrideAttendeeId) {

        overrideAttendeeId.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    if (overridePin) {
                        overridePin.focus();
                    }

                }

            }
        );

    }


    if (overridePin) {

        overridePin.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    processManualOverride();

                }

            }
        );

    }

}


/* =========================================================
   QR SCANNER
========================================================= */

function initializeScanner() {

    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        updateStatus(
            "error",
            "SCANNER ERROR",
            "",
            "",
            "QR scanner library failed to load."
        );

        return;
    }


    html5QrCode =
        new Html5Qrcode("reader");


    const scannerConfig = {

        fps: 15,

        qrbox: function(
            viewfinderWidth,
            viewfinderHeight
        ) {

            const size =
                Math.floor(
                    Math.min(
                        viewfinderWidth,
                        viewfinderHeight
                    ) * 0.65
                );

            return {
                width: Math.max(180, size),
                height: Math.max(180, size)
            };

        },

        aspectRatio: 1.0,

        rememberLastUsedCamera: true

    };


    /*
        Use a normal environment preference.

        Do NOT use:

        facingMode: {
            exact: "environment"
        }

        because some browsers/devices reject that
        constraint and return OverconstrainedError.
    */

    html5QrCode
        .start(
            {
                facingMode: "environment"
            },
            scannerConfig,
            handleQrSuccess,
            handleQrError
        )
        .catch(error => {

            console.error(
                "Camera initialization failed:",
                error
            );


            /*
                FALLBACK CAMERA

                If the browser cannot satisfy the
                environment-camera preference, try
                the default available camera.
            */

            if (
                error &&
                error.name === "OverconstrainedError"
            ) {

                console.warn(
                    "Environment camera constraint rejected. Retrying with default camera."
                );


                if (html5QrCode) {

                    html5QrCode
                        .start(
                            {
                                video: true
                            },
                            scannerConfig,
                            handleQrSuccess,
                            handleQrError
                        )
                        .catch(fallbackError => {

                            console.error(
                                "Fallback camera initialization failed:",
                                fallbackError
                            );

                            updateStatus(
                                "error",
                                "CAMERA UNAVAILABLE",
                                "",
                                "",
                                getCameraErrorMessage(
                                    fallbackError
                                )
                            );

                        });

                }

                return;
            }


            updateStatus(
                "error",
                "CAMERA UNAVAILABLE",
                "",
                "",
                getCameraErrorMessage(error)
            );

        });

}


/* =========================================================
   CAMERA ERROR MESSAGE
========================================================= */

function getCameraErrorMessage(error) {

    const errorName =
        error &&
        error.name
            ? String(error.name).toLowerCase()
            : "";

    const message =
        String(error || "").toLowerCase();


    if (
        errorName === "notallowederror" ||
        message.includes("permission") ||
        message.includes("notallowed")
    ) {

        return (
            "Camera permission was denied. " +
            "Please allow camera access in your browser settings."
        );

    }


    if (
        errorName === "notfounderror" ||
        message.includes("notfound") ||
        message.includes("devicesnotfound")
    ) {

        return (
            "No camera was detected on this device."
        );

    }


    if (
        errorName === "overconstrainederror" ||
        message.includes("overconstrained")
    ) {

        return (
            "The selected camera mode is not supported by this device. " +
            "Please refresh the page and try again."
        );

    }


    if (
        errorName === "notreadableerror" ||
        message.includes("notreadable") ||
        message.includes("trackstart")
    ) {

        return (
            "The camera is already being used by another application. " +
            "Close other camera applications and try again."
        );

    }


    if (
        errorName === "securityerror"
    ) {

        return (
            "The browser blocked camera access. " +
            "Please make sure the scanner is opened using HTTPS and camera permission is allowed."
        );

    }


    return (
        "Unable to initialize the camera. " +
        "You may still enter the Attendee ID manually."
    );

}


/* =========================================================
   QR SUCCESS
========================================================= */

function handleQrSuccess(decodedText) {

    const now =
        Date.now();


    /*
        Prevent html5-qrcode from submitting the same
        QR code repeatedly within the cooldown period.
    */

    if (
        decodedText === lastScannedCode &&
        now - lastScanTime < SCAN_COOLDOWN
    ) {

        return;

    }


    lastScannedCode =
        decodedText;

    lastScanTime =
        now;


    const attendeeId =
        String(decodedText)
            .trim()
            .toUpperCase();


    if (!attendeeId) {

        return;

    }


    if (searchInput) {

        searchInput.value =
            attendeeId;

    }


    processCheckIn(attendeeId);

}


/* =========================================================
   QR ERROR CALLBACK
========================================================= */

function handleQrError(errorMessage) {

    /*
        html5-qrcode calls this continuously
        while searching for a QR code.

        Do NOT display an error here.
        Otherwise the screen would constantly
        show false errors while scanning.
    */

}


/* =========================================================
   MANUAL ID
========================================================= */

function submitManualId() {

    if (!searchInput) {
        return;
    }


    const attendeeId =
        searchInput.value
            .trim()
            .toUpperCase();


    if (!attendeeId) {

        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            "",
            "Please enter an Attendee ID."
        );

        searchInput.focus();

        return;

    }


    processCheckIn(attendeeId);

}


/* =========================================================
   PROCESS CHECK-IN
========================================================= */

function processCheckIn(attendeeId) {

    if (isProcessing) {

        return;

    }


    const session =
        getSelectedStation();


    if (!session) {

        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            "",
            "Please select a check-in station."
        );

        return;

    }


    isProcessing = true;

    setProcessingState(true);


    updateStatus(
        "idle",
        "VERIFYING",
        "",
        "",
        `Checking ${attendeeId}...`
    );


    const payload = {

        action: "scan",

        attendeeId: attendeeId,

        session: session

    };


    fetch(
        DEPLOYED_WEB_APP_URL,
        {

            method: "POST",

            redirect: "follow",

            headers: {

                "Content-Type":
                    "text/plain;charset=utf-8"

            },

            body:
                JSON.stringify(payload)

        }
    )

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        return response.text();

    })

    .then(text => {

        console.log(
            "Apps Script response:",
            text
        );


        let result;


        try {

            result =
                JSON.parse(text);

        }

        catch (error) {

            console.error(
                "JSON parsing failed:",
                error
            );

            throw new Error(
                "Invalid JSON response from Apps Script."
            );

        }


        handleResponse(result);

    })

    .catch(error => {

        console.error(
            "Check-in request failed:",
            error
        );


        handleError(error);

    });

}


/* =========================================================
   HANDLE RESPONSE
========================================================= */

function handleResponse(res) {

    console.log(
        "Processed result:",
        res
    );


    /*
        IMPORTANT

        Apps Script responses may be returned as:

        1. Direct object:

        {
            status: "SUCCESS",
            name: "CASEY JASPER CHAVEZ",
            attendeeId: "ATT-IND-CHAVEZ1",
            timestamp: "...",
            message: "..."
        }

        OR:

        2. Wrapped object:

        {
            found: true,
            result: {
                status: "SUCCESS",
                name: "CASEY JASPER CHAVEZ",
                attendeeId: "ATT-IND-CHAVEZ1",
                timestamp: "...",
                message: "..."
            }
        }

        This normalization handles BOTH.
    */

    const data =
        res &&
        res.result &&
        typeof res.result === "object"
            ? res.result
            : res;


    /* ---------------------------------------------------------
       INVALID RESPONSE
    --------------------------------------------------------- */

    if (
        !data ||
        typeof data !== "object"
    ) {

        console.error(
            "Invalid Apps Script response:",
            res
        );


        playSound("error");


        const timestamp =
            getCurrentTimestamp();


        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            timestamp,
            "The check-in server returned an invalid response."
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            "",
            "",
            timestamp,
            "The check-in server returned an invalid response."
        );


        finishProcessing();

        return;

    }


    /* ---------------------------------------------------------
       NORMALIZE RESPONSE VALUES
    --------------------------------------------------------- */

    const status =
        String(
            data.status || ""
        )
            .trim()
            .toUpperCase();


    const displayStatus =
        String(
            data.displayStatus ||
            getDisplayStatus(status)
        )
            .trim();


    const name =
        String(
            data.name || ""
        )
            .trim();


    const attendeeId =
        String(
            data.attendeeId || ""
        )
            .trim();


    const timestamp =
        String(
            data.timestamp || ""
        )
            .trim();


    const message =
        String(
            data.message ||
            "No additional information was provided."
        )
            .trim();


    // School is returned by Code.gs for BOTH individual and bulk scans.
    const school =
        String(
            data.school ||
            data.schoolName ||
            data.organization ||
            data.institution ||
            ""
        )
            .trim();


    const bulkInfo =
        normalizeBulkInfo(data);


    console.log(
        "Normalized scan response:",
        {
            status: status,
            displayStatus: displayStatus,
            name: name,
            attendeeId: attendeeId,
            timestamp: timestamp,
            message: message,
            bulkInfo: bulkInfo
        }
    );


    /* =========================================================
       SUCCESS
    ========================================================= */

    if (
        status === "SUCCESS"
    ) {

        playSound("success");


        /*
            If the backend sends the attendee name,
            use it.

            If the name is unavailable but the attendee ID
            exists, display the attendee ID instead.

            This prevents the misleading:

            "ATTENDEE NOT IDENTIFIED"

            message.
        */

        const safeName =
            name ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        const safeMessage =
            message ||
            "Check-in recorded successfully.";


        updateStatus(
            "success",
            "SCAN SUCCESSFULLY",
            safeName,
            safeTimestamp,
            safeMessage,
            bulkInfo,
            school
        );


        showResultModal(
            "success",
            "SCAN SUCCESSFULLY",
            safeName,
            attendeeId,
            safeTimestamp,
            safeMessage,
            bulkInfo,
            school
        );


        clearInput();


        finishProcessing();

        return;

    }


    /* =========================================================
       ALREADY SCANNED
    ========================================================= */

    if (
        status === "ALREADY_SCANNED" ||
        status === "ALREADY_PROCESSED"
    ) {

        playSound("error");


        const safeName =
            name ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        const safeMessage =
            message ||
            "This attendee has already been recorded.";


        updateStatus(
            "already",
            "ALREADY SCANNED",
            safeName,
            safeTimestamp,
            safeMessage,
            bulkInfo,
            school
        );


        showResultModal(
            "already",
            "ALREADY SCANNED",
            safeName,
            attendeeId,
            safeTimestamp,
            safeMessage,
            bulkInfo
        );


        clearInput();


        finishProcessing();

        return;

    }


    /* =========================================================
       BLOCKED / VALIDATION FAILURE
    ========================================================= */

    if (
        status === "BLOCKED"
    ) {

        playSound("error");


        const safeName =
            name ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        const safeMessage =
            message ||
            "This check-in cannot be processed yet.";


        updateStatus(
            "error",
            "TRY AGAIN",
            safeName,
            safeTimestamp,
            safeMessage,
            bulkInfo
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            safeName,
            attendeeId,
            safeTimestamp,
            safeMessage,
            bulkInfo
        );


        finishProcessing();

        return;

    }


    /* =========================================================
       INVALID / UNKNOWN ERROR
    ========================================================= */

    playSound("error");


    const safeName =
        name ||
        attendeeId ||
        "";


    const safeTimestamp =
        timestamp ||
        getCurrentTimestamp();


    const safeMessage =
        message ||
        "Unable to process this check-in. Please try again.";


    updateStatus(
        "error",
        "TRY AGAIN",
        safeName,
        safeTimestamp,
        safeMessage
    );


    showResultModal(
        "error",
        "TRY AGAIN",
        safeName,
        attendeeId,
        safeTimestamp,
        safeMessage
    );


    finishProcessing();

}


/* =========================================================
   FINISH PROCESSING
========================================================= */

function finishProcessing() {

    setTimeout(() => {

        isProcessing = false;

        setProcessingState(false);

    }, 500);

}


/* =========================================================
   HANDLE REQUEST ERROR
========================================================= */

function handleError(error) {

    console.error(
        "Request error:",
        error
    );


    playSound("error");


    const timestamp =
        getCurrentTimestamp();


    updateStatus(
        "error",
        "CONNECTION ERROR",
        "",
        timestamp,
        "Unable to communicate with the check-in server. Please try again."
    );


    showResultModal(
        "error",
        "TRY AGAIN",
        "",
        "",
        timestamp,
        "Unable to communicate with the check-in server. Please try again."
    );


    finishProcessing();

}


/* =========================================================
   STATUS DISPLAY
========================================================= */

function updateStatus(
    type,
    title,
    name,
    timestamp,
    message,
    bulkInfo = null
) {

    if (!statusBox) {
        return;
    }


    statusBox.className =
        `result-panel ${type}`;


    if (resultTitle) {

        resultTitle.textContent =
            title ||
            "READY TO SCAN";

    }


    if (resultName) {

        resultName.textContent =
            name ||
            "No attendee scanned";

    }


    if (resultTime) {

        resultTime.textContent =
            timestamp ||
            "Waiting for QR code...";

    }


    if (resultMessage) {

        resultMessage.textContent =
            message ||
            "Select a station and scan an attendee QR code.";

    }


    renderBulkRegistrationInfo(
        bulkRegistrationInfo,
        bulkInfo
    );


    updateResultIcon(type);

}


/* =========================================================
   RESULT ICON
========================================================= */

function updateResultIcon(type) {

    if (!statusBox) {
        return;
    }


    const icon =
        statusBox.querySelector(
            ".result-icon i"
        );


    if (!icon) {
        return;
    }


    icon.className =
        "bi";


    if (
        type === "success"
    ) {

        icon.classList.add(
            "bi-check-circle-fill"
        );

    }


    else if (
        type === "already"
    ) {

        icon.classList.add(
            "bi-exclamation-circle-fill"
        );

    }


    else if (
        type === "error"
    ) {

        icon.classList.add(
            "bi-x-circle-fill"
        );

    }


    else {

        icon.classList.add(
            "bi-qr-code"
        );

    }

}


/* =========================================================
   RESULT MODAL
========================================================= */

/* =========================================================
   RESULT MODAL
   MOBILE-FIRST SCAN RESULT DISPLAY
========================================================= */

function showResultModal(
    type,
    status,
    name,
    attendeeId,
    timestamp,
    message,
    bulkInfo = null,
    school = ""
) {
    const modalElement = document.getElementById("resultModal");

    if (!modalElement) {
        console.error("Result modal element not found.");
        return;
    }

    /* -----------------------------------------------------
       GET MODAL ELEMENTS
    ----------------------------------------------------- */

    const modalIcon =
        document.getElementById("modalIcon");

    const modalStatus =
        document.getElementById("modalStatus");

    const modalName =
        document.getElementById("modalName");

    const modalId =
        document.getElementById("modalId");

    const modalTime =
        document.getElementById("modalTime");

    const modalMessage =
        document.getElementById("modalMessage");


    const bulkInfoContainer =
        getOrCreateBulkInfoContainer(modalElement);


    const individualSchoolContainer =
        getOrCreateIndividualSchoolContainer(
            modalElement,
            modalName
        );


    /* -----------------------------------------------------
       NORMALIZE DATA
    ----------------------------------------------------- */

    const safeType =
        String(type || "error").toLowerCase();

    const safeStatus =
        String(status || "TRY AGAIN");

    const safeName =
        String(name || attendeeId || "ATTENDEE");

    const safeId =
        String(attendeeId || "NO ATTENDEE ID");

    const safeTimestamp =
        String(timestamp || getCurrentTimestamp());

    const safeMessage =
        String(
            message ||
            "Please try again."
        );


    const safeSchool =
        String(
            school ||
            ""
        ).trim();


    /* -----------------------------------------------------
       RESET MODAL
    ----------------------------------------------------- */

    modalElement.classList.remove(
        "modal-success",
        "modal-already",
        "modal-error"
    );


    /* -----------------------------------------------------
       STATUS TYPE
    ----------------------------------------------------- */

    if (safeType === "success") {

        modalElement.classList.add(
            "modal-success"
        );

        if (modalIcon) {
            modalIcon.innerHTML =
                '<i class="bi bi-check-lg"></i>';
        }

        if (modalStatus) {
            modalStatus.textContent =
                "SCAN SUCCESSFULLY";
        }

    }

    else if (safeType === "already") {

        modalElement.classList.add(
            "modal-already"
        );

        if (modalIcon) {
            modalIcon.innerHTML =
                '<i class="bi bi-exclamation-lg"></i>';
        }

        if (modalStatus) {
            modalStatus.textContent =
                "ALREADY SCANNED";
        }

    }

    else {

        modalElement.classList.add(
            "modal-error"
        );

        if (modalIcon) {
            modalIcon.innerHTML =
                '<i class="bi bi-x-lg"></i>';
        }

        if (modalStatus) {
            modalStatus.textContent =
                safeStatus;
        }
    }


    /* -----------------------------------------------------
       POPULATE ATTENDEE INFORMATION
    ----------------------------------------------------- */

    if (modalName) {
        modalName.textContent =
            safeName;
    }

    if (modalId) {
        modalId.textContent =
            safeId;
    }

    if (modalTime) {
        modalTime.textContent =
            safeTimestamp;
    }

    if (modalMessage) {
        modalMessage.textContent =
            safeMessage;
    }


    renderIndividualSchoolInfo(
        individualSchoolContainer,
        safeSchool,
        bulkInfo
    );


    renderBulkRegistrationInfo(
        bulkInfoContainer,
        bulkInfo
    );


    /* -----------------------------------------------------
       SHOW MODAL
    ----------------------------------------------------- */

    try {

        const modal =
            bootstrap.Modal.getOrCreateInstance(
                modalElement,
                {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                }
            );

        modal.show();

        /*
         * Force the modal to the front.
         * This is particularly useful on mobile browsers
         * where scanner/video elements may create stacking
         * contexts.
         */

        requestAnimationFrame(() => {

            modalElement.style.zIndex = "1060";

            const backdrop =
                document.querySelector(
                    ".modal-backdrop"
                );

            if (backdrop) {
                backdrop.style.zIndex = "1055";
            }

        });

    }

    catch (error) {

        console.error(
            "Unable to display result modal:",
            error
        );

        /*
         * Fallback:
         * If Bootstrap fails for any reason,
         * keep the result visible in the main status panel.
         */

        updateStatus(
            safeType,
            safeStatus,
            safeName,
            safeTimestamp,
            safeMessage
        );
    }
}


/* =========================================================
   INDIVIDUAL SCHOOL DISPLAY
========================================================= */

function getOrCreateIndividualSchoolContainer(
    modalElement,
    modalName
) {

    let container =
        modalElement.querySelector(
            "#individualSchoolDisplay"
        );

    if (container) {
        return container;
    }

    container =
        document.createElement("div");

    container.id =
        "individualSchoolDisplay";

    container.className =
        "individual-school-display";

    container.innerHTML = `
        <div class="individual-school-label">
            SCHOOL / ORGANIZATION
        </div>
        <div class="individual-school-name"></div>
    `;

    if (!document.getElementById("individualSchoolDisplayStyles")) {
        const style = document.createElement("style");
        style.id = "individualSchoolDisplayStyles";
        style.textContent = `
            #individualSchoolDisplay {
                margin: 4px 0 12px;
                text-align: center;
                line-height: 1.25;
            }
            #individualSchoolDisplay .individual-school-label {
                font-size: 11px;
                font-weight: 700;
                letter-spacing: .6px;
                opacity: .72;
                margin-bottom: 3px;
            }
            #individualSchoolDisplay .individual-school-name {
                font-size: 14px;
                font-weight: 700;
                overflow-wrap: anywhere;
            }
        `;
        document.head.appendChild(style);
    }

    if (modalName) {
        modalName.insertAdjacentElement(
            "afterend",
            container
        );
    } else {
        modalElement.appendChild(container);
    }

    return container;
}


function renderIndividualSchoolInfo(
    container,
    school,
    bulkInfo
) {

    if (!container) {
        return;
    }

    // Bulk registrations have their school displayed inside the
    // dedicated BULK REGISTRATION summary.
    if (
        bulkInfo &&
        bulkInfo.isBulk === true
    ) {
        container.style.display = "none";
        return;
    }

    const nameElement =
        container.querySelector(
            ".individual-school-name"
        );

    if (nameElement) {
        nameElement.textContent =
            school || "School Not Specified";
    }

    container.style.display = "block";
}


/* =========================================================
   BULK REGISTRATION DATA
========================================================= */

function normalizeBulkInfo(data) {

    if (!data || typeof data !== "object") {
        return null;
    }

    const source =
        data.bulkInfo &&
        typeof data.bulkInfo === "object"
            ? data.bulkInfo
            : data;

    const school = firstValue(
        source.school,
        source.schoolName,
        source.organization,
        source.institution
    );

    let headcount = toNumber(firstValue(
        source.headcount,
        source.headCount,
        source.totalHeadcount,
        source.total_headcount,
        source.totalParticipants,
        source.totalParticipantsCount
    ));

    let free = toNumber(firstValue(
        source.free,
        source.freeCount,
        source.freeParticipants,
        source.freeRegistration,
        source.freeRegistrations,
        source.free_headcount
    ));

    let paying = toNumber(firstValue(
        source.paying,
        source.payee,
        source.paid,
        source.payingParticipants,
        source.paidParticipants,
        source.payerCount
    ));

    if (headcount !== null && free === null) {
        free = Math.floor(headcount / 30);
    }

    if (headcount !== null && paying === null && free !== null) {
        paying = Math.max(0, headcount - free);
    }

    // Only show the BULK panel when the backend explicitly identifies
    // the scan as bulk or supplies actual bulk registration counts.
    // An individual attendee also has a school, so school alone must
    // NOT make the response appear as a bulk registration.
    const isExplicitBulk =
        data.isBulk === true ||
        (data.bulkInfo && data.bulkInfo.isBulk === true);

    const hasBulkCounts =
        headcount !== null ||
        free !== null ||
        paying !== null;

    const hasBulkData =
        isExplicitBulk ||
        hasBulkCounts;

    if (!hasBulkData) {
        return null;
    }

    return {
        school: school || "NOT PROVIDED",
        headcount: headcount !== null ? headcount : "—",
        paying: paying !== null ? paying : "—",
        free: free !== null ? free : "—"
    };
}

function firstValue(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }
    return null;
}

function toNumber(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return null;
    }

    const number = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(number) ? number : null;
}

function getOrCreateBulkInfoContainer(modalElement) {

    if (!modalElement) return null;

    let container = modalElement.querySelector("#bulkRegistrationInfo");
    if (container) return container;

    const modalMessage = modalElement.querySelector("#modalMessage");
    if (!modalMessage) return null;

    container = document.createElement("div");
    container.id = "bulkRegistrationInfo";
    container.style.display = "none";
    container.style.marginTop = "16px";
    container.style.padding = "14px";
    container.style.borderRadius = "16px";
    container.style.background = "linear-gradient(145deg, rgba(255,255,255,.075), rgba(0,0,0,.16))";
    container.style.border = "1px solid rgba(0, 220, 210, .18)";
    container.style.boxShadow = "inset 2px 2px 8px rgba(255,255,255,.035), inset -3px -3px 10px rgba(0,0,0,.18)";
    container.style.backdropFilter = "blur(10px)";
    container.style.webkitBackdropFilter = "blur(10px)";
    container.style.textAlign = "left";

    modalMessage.insertAdjacentElement("afterend", container);
    return container;
}

function renderBulkRegistrationInfo(container, info) {

    if (!container) return;

    if (!info) {
        container.innerHTML = "";
        container.style.display = "none";
        return;
    }

    const escape = value => String(value ?? "—")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    container.innerHTML = `
        <div style="font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;opacity:.72;margin-bottom:10px;">BULK REGISTRATION</div>
        <div style="font-size:15px;font-weight:800;line-height:1.25;margin-bottom:12px;overflow-wrap:anywhere;">${escape(info.school)}</div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
            <div style="padding:10px 8px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.06);text-align:center;">
                <div style="font-size:9px;opacity:.62;font-weight:700;">HEADCOUNT</div>
                <div style="font-size:20px;font-weight:900;margin-top:3px;">${escape(info.headcount)}</div>
            </div>
            <div style="padding:10px 8px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.06);text-align:center;">
                <div style="font-size:9px;opacity:.62;font-weight:700;">PAYING</div>
                <div style="font-size:20px;font-weight:900;margin-top:3px;">${escape(info.paying)}</div>
            </div>
            <div style="padding:10px 8px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.06);text-align:center;">
                <div style="font-size:9px;opacity:.62;font-weight:700;">FREE</div>
                <div style="font-size:20px;font-weight:900;margin-top:3px;">${escape(info.free)}</div>
            </div>
        </div>
    `;

    container.style.display = "block";
}


/* =========================================================
   SELECTED STATION
========================================================= */

function getSelectedStation() {

    const selected =
        document.querySelector(
            'input[name="session"]:checked'
        );


    return selected
        ? selected.value
        : null;

}


/* =========================================================
   DISPLAY STATUS FALLBACK
========================================================= */

function getDisplayStatus(status) {

    switch (status) {

        case "SUCCESS":

            return "SCAN SUCCESSFULLY";


        case "ALREADY_SCANNED":

        case "ALREADY_PROCESSED":

            return "ALREADY SCANNED";


        case "BLOCKED":

        case "INVALID":

        case "ERROR":

            return "TRY AGAIN";


        default:

            return "TRY AGAIN";

    }

}


/* =========================================================
   INPUT CLEAR
========================================================= */

function clearInput() {

    if (searchInput) {

        searchInput.value = "";

    }

}


/* =========================================================
   PROCESSING STATE
========================================================= */

function setProcessingState(processing) {

    if (!submitBtn) {
        return;
    }


    submitBtn.disabled =
        processing;


    if (processing) {

        submitBtn.innerHTML =
            `
            <i class="bi bi-arrow-repeat"></i>
            <span>VERIFYING</span>
            `;

    }


    else {

        submitBtn.innerHTML =
            `
            <i class="bi bi-arrow-right-circle"></i>
            <span>SUBMIT</span>
            `;

    }

}


/* =========================================================
   MANUAL OVERRIDE
========================================================= */

function openOverrideModal() {

    if (overrideAttendeeId) {

        overrideAttendeeId.value =
            searchInput
                ? searchInput.value
                    .trim()
                    .toUpperCase()
                : "";

    }


    if (overridePin) {

        overridePin.value =
            "";

    }


    const modalElement =
        document.getElementById(
            "overrideModal"
        );


    if (!modalElement) {

        console.error(
            "Override modal element not found."
        );

        return;

    }


    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElement
        );


    modal.show();


    setTimeout(() => {

        if (
            overrideAttendeeId &&
            overrideAttendeeId.value
        ) {

            if (overridePin) {

                overridePin.focus();

            }

        }

        else if (
            overrideAttendeeId
        ) {

            overrideAttendeeId.focus();

        }

    }, 300);

}


/* =========================================================
   PROCESS MANUAL OVERRIDE
========================================================= */

function processManualOverride() {

    const attendeeId =
        overrideAttendeeId
            ? overrideAttendeeId.value
                .trim()
                .toUpperCase()
            : "";


    const pin =
        overridePin
            ? overridePin.value
            : "";


    const session =
        getSelectedStation();


    if (!attendeeId) {

        alert(
            "Please enter an Attendee ID."
        );


        if (overrideAttendeeId) {

            overrideAttendeeId.focus();

        }


        return;

    }


    if (!pin) {

        alert(
            "Please enter the override PIN."
        );


        if (overridePin) {

            overridePin.focus();

        }


        return;

    }


    if (!session) {

        alert(
            "Please select a check-in station."
        );


        return;

    }


    if (confirmOverride) {

        confirmOverride.disabled =
            true;


        confirmOverride.innerHTML =
            `
            <i class="bi bi-arrow-repeat"></i>
            VERIFYING AUTHORIZATION...
            `;

    }


    fetch(
        DEPLOYED_WEB_APP_URL,
        {

            method: "POST",

            redirect: "follow",

            headers: {

                "Content-Type":
                    "text/plain;charset=utf-8"

            },

            body:
                JSON.stringify({

                    action:
                        "manualOverride",

                    attendeeId:
                        attendeeId,

                    session:
                        session,

                    pin:
                        pin

                })

        }
    )

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        return response.text();

    })

    .then(text => {

        console.log(
            "Manual override response:",
            text
        );


        let result;


        try {

            result =
                JSON.parse(text);

        }

        catch (error) {

            throw new Error(
                "Invalid JSON response from Apps Script."
            );

        }


        handleOverrideResponse(
            result,
            attendeeId
        );

    })

    .catch(error => {

        console.error(
            "Manual override error:",
            error
        );


        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            getCurrentTimestamp(),
            "Unable to process manual override."
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            "",
            attendeeId,
            getCurrentTimestamp(),
            "Unable to process manual override."
        );

    })

    .finally(() => {

        if (confirmOverride) {

            confirmOverride.disabled =
                false;


            confirmOverride.innerHTML =
                `
                <i class="bi bi-shield-check"></i>
                AUTHORIZE OVERRIDE
                `;

        }

    });

}


/* =========================================================
   MANUAL OVERRIDE RESPONSE
========================================================= */

function handleOverrideResponse(
    res,
    attendeeId
) {

    /*
        Normalize wrapped responses too.
    */

    const data =
        res &&
        res.result &&
        typeof res.result === "object"
            ? res.result
            : res;


    if (!data || typeof data !== "object") {

        playSound("error");


        showResultModal(
            "error",
            "TRY AGAIN",
            "",
            attendeeId,
            getCurrentTimestamp(),
            "Invalid response from the check-in server."
        );


        return;

    }


    const status =
        String(
            data.status || ""
        )
            .trim()
            .toUpperCase();


    const name =
        String(
            data.name || ""
        )
            .trim();


    const timestamp =
        String(
            data.timestamp || ""
        )
            .trim();


    const message =
        String(
            data.message ||
            "Manual override completed."
        )
            .trim();


    const school =
        String(
            data.school ||
            data.schoolName ||
            data.organization ||
            data.institution ||
            ""
        )
            .trim();


    /* ---------------------------------------------------------
       SUCCESS
    --------------------------------------------------------- */

    if (
        status === "SUCCESS"
    ) {

        playSound("success");


        const safeName =
            name ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        updateStatus(
            "success",
            "SCAN SUCCESSFULLY",
            safeName,
            safeTimestamp,
            message,
            null,
            school
        );


        showResultModal(
            "success",
            "SCAN SUCCESSFULLY",
            safeName,
            attendeeId,
            safeTimestamp,
            message,
            null,
            school
        );


        closeOverrideModal();


        clearInput();


        return;

    }


    /* ---------------------------------------------------------
       ALREADY SCANNED
    --------------------------------------------------------- */

    if (
        status === "ALREADY_SCANNED" ||
        status === "ALREADY_PROCESSED"
    ) {

        playSound("error");


        const safeName =
            name ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            timestamp ||
            getCurrentTimestamp();


        updateStatus(
            "already",
            "ALREADY SCANNED",
            safeName,
            safeTimestamp,
            message,
            null,
            school
        );


        showResultModal(
            "already",
            "ALREADY SCANNED",
            safeName,
            attendeeId,
            safeTimestamp,
            message,
            null,
            school
        );


        closeOverrideModal();


        return;

    }


    /* ---------------------------------------------------------
       INVALID PIN
    --------------------------------------------------------- */

    if (
        status === "INVALID_PIN"
    ) {

        playSound("error");


        if (overridePin) {

            overridePin.value =
                "";

        }


        alert(
            "Invalid override PIN."
        );


        if (overridePin) {

            overridePin.focus();

        }


        return;

    }


    /* ---------------------------------------------------------
       OTHER ERROR
    --------------------------------------------------------- */

    playSound("error");


    const safeName =
        name ||
        attendeeId ||
        "";


    const safeTimestamp =
        timestamp ||
        getCurrentTimestamp();


    showResultModal(
        "error",
        "TRY AGAIN",
        safeName,
        attendeeId,
        safeTimestamp,
        message
    );

}


/* =========================================================
   CLOSE OVERRIDE MODAL
========================================================= */

function closeOverrideModal() {

    const modalElement =
        document.getElementById(
            "overrideModal"
        );


    if (!modalElement) {

        return;

    }


    const modal =
        bootstrap.Modal.getInstance(
            modalElement
        );


    if (modal) {

        modal.hide();

    }

}


/* =========================================================
   AUDIO FEEDBACK
========================================================= */

function playSound(type) {

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContext) {

            return;

        }


        const context =
            new AudioContext();


        const oscillator =
            context.createOscillator();


        const gain =
            context.createGain();


        oscillator.connect(
            gain
        );


        gain.connect(
            context.destination
        );


        /* -----------------------------------------------------
           SUCCESS SOUND
        ----------------------------------------------------- */

        if (
            type === "success"
        ) {

            oscillator.frequency.setValueAtTime(
                880,
                context.currentTime
            );


            oscillator.frequency.setValueAtTime(
                1175,
                context.currentTime + 0.10
            );


            gain.gain.setValueAtTime(
                0.18,
                context.currentTime
            );


            gain.gain.exponentialRampToValueAtTime(
                0.001,
                context.currentTime + 0.30
            );


            oscillator.start();


            oscillator.stop(
                context.currentTime + 0.30
            );

        }


        /* -----------------------------------------------------
           ERROR SOUND
        ----------------------------------------------------- */

        else {

            oscillator.frequency.setValueAtTime(
                220,
                context.currentTime
            );


            oscillator.frequency.setValueAtTime(
                150,
                context.currentTime + 0.12
            );


            gain.gain.setValueAtTime(
                0.20,
                context.currentTime
            );


            gain.gain.exponentialRampToValueAtTime(
                0.001,
                context.currentTime + 0.30
            );


            oscillator.start();


            oscillator.stop(
                context.currentTime + 0.30
            );

        }

    }

    catch (error) {

        console.warn(
            "Audio feedback unavailable.",
            error
        );

    }

}


/* =========================================================
   CURRENT TIMESTAMP FALLBACK
========================================================= */

function getCurrentTimestamp() {

    const now =
        new Date();


    return now.toLocaleString(
        "en-PH",
        {

            year: "numeric",

            month: "2-digit",

            day: "2-digit",

            hour: "2-digit",

            minute: "2-digit",

            second: "2-digit",

            hour12: true

        }
    );

}