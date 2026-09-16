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

        /*
         * Apps Script web-app responses can sometimes contain
         * surrounding whitespace or a wrapper around the JSON.
         * Extract the JSON object before declaring the request
         * failed. This prevents a successful Sheet write from
         * being incorrectly shown as a CONNECTION ERROR.
         */
        let result = null;
        const rawText = String(text || "").trim();

        try {
            result = JSON.parse(rawText);
        } catch (error) {
            const firstBrace = rawText.indexOf("{");
            const lastBrace = rawText.lastIndexOf("}");

            if (
                firstBrace !== -1 &&
                lastBrace > firstBrace
            ) {
                try {
                    result = JSON.parse(
                        rawText.substring(
                            firstBrace,
                            lastBrace + 1
                        )
                    );
                } catch (nestedError) {
                    console.error(
                        "JSON parsing failed:",
                        nestedError
                    );
                }
            }

            if (!result) {
                console.error(
                    "Invalid Apps Script response:",
                    rawText
                );

                throw new Error(
                    "Invalid JSON response from Apps Script."
                );
            }
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


    const school =
        String(
            data.school || ""
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
    /* ---------------------------------------------------------
       BULK REGISTRATION INFORMATION
    --------------------------------------------------------- */

    const bulkFlag =
        data.isBulk === true ||
        String(data.isBulk || "").toLowerCase() === "true" ||
        String(data.isBulk || "") === "1" ||
        String(data.attendeeId || "").toUpperCase().startsWith("ATT-BLK-");

    const bulkInfo =
        bulkFlag
            ? {
                isBulk: true,

                school:
                    String(
                        data.school || ""
                    ).trim(),

                headcount:
                    Number(
                        data.headcount || 0
                    ),

                free:
                    Number(
                        data.free || 0
                    ),

                payingParticipants:
                    Number(
                        data.payingParticipants ??
                        Math.max(
                            Number(data.headcount || 0) -
                            Number(data.free || 0),
                            0
                        )
                    )
            }
            : null;

    console.log(
        "Normalized scan response:",
        {
            status: status,
            displayStatus: displayStatus,
            name: name,
            attendeeId: attendeeId,
            timestamp: timestamp,
            message: message
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
            safeMessage
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
            safeMessage
        );


        showResultModal(
            "already",
            "ALREADY SCANNED",
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
            safeMessage
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            safeName,
            attendeeId,
            safeTimestamp,
            safeMessage,
            null,
            school
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
        safeMessage,
        null,
        school
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
    message
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

    try {
        const modalIcon = document.getElementById("modalIcon");
        const modalStatus = document.getElementById("modalStatus");
        const modalName = document.getElementById("modalName");
        const modalId = document.getElementById("modalId");
        const modalTime = document.getElementById("modalTime");
        const modalMessage = document.getElementById("modalMessage");
        const bulkRegistrationInfo = document.getElementById("bulkRegistrationInfo");
        const modalSchool = document.getElementById("modalSchool");
        const modalHeadcount = document.getElementById("modalHeadcount");
        const modalPaying = document.getElementById("modalPaying");
        const modalFree = document.getElementById("modalFree");

        const safeType = String(type || "error").trim().toLowerCase();
        const safeStatus = String(status || "TRY AGAIN").trim();
        const safeName = String(name || attendeeId || "ATTENDEE").trim();
        const safeId = String(attendeeId || "NO ATTENDEE ID").trim();
        const safeTimestamp = String(timestamp || getCurrentTimestamp()).trim();
        const safeMessage = String(message || "Please try again.").trim();

        /* ---------------------------------------------------------
           DETERMINE BULK FROM THE ACTUAL RESPONSE / ID.
           This works even if Apps Script returns isBulk as a string.
        --------------------------------------------------------- */
        const isBulk =
            !!bulkInfo &&
            (
                bulkInfo.isBulk === true ||
                String(bulkInfo.isBulk || "").toLowerCase() === "true" ||
                String(bulkInfo.isBulk || "") === "1"
            ) ||
            /^ATT-BLK-/i.test(safeId);

        /* ---------------------------------------------------------
           RESET MODAL STATE
        --------------------------------------------------------- */
        modalElement.classList.remove(
            "modal-success",
            "modal-already",
            "modal-error"
        );

        if (safeType === "success") {
            modalElement.classList.add("modal-success");
            if (modalIcon) {
                modalIcon.innerHTML = '<i class="bi bi-check-lg"></i>';
            }
            if (modalStatus) {
                modalStatus.textContent = "SCAN SUCCESSFULLY";
            }
        } else if (safeType === "already") {
            modalElement.classList.add("modal-already");
            if (modalIcon) {
                modalIcon.innerHTML = '<i class="bi bi-exclamation-lg"></i>';
            }
            if (modalStatus) {
                modalStatus.textContent = "ALREADY SCANNED";
            }
        } else {
            modalElement.classList.add("modal-error");
            if (modalIcon) {
                modalIcon.innerHTML = '<i class="bi bi-x-lg"></i>';
            }
            if (modalStatus) {
                modalStatus.textContent = safeStatus;
            }
        }

        /* ---------------------------------------------------------
           COMMON INFORMATION
        --------------------------------------------------------- */
        if (modalName) {
            modalName.textContent = safeName;
        }

        if (modalId) {
            modalId.textContent = safeId;
        }

        const selectedStation = getSelectedStation();
        if (modalTime) {
            if (
                selectedStation === "ATTENDANCE" &&
                (safeType === "success" || safeType === "already")
            ) {
                modalTime.textContent = "PRESENT • " + safeTimestamp;
            } else {
                modalTime.textContent = safeTimestamp;
            }
        }

        if (modalMessage) {
            modalMessage.textContent = safeMessage;
        }

        /* ---------------------------------------------------------
           REMOVE THE OLD GENERIC SCHOOL / ORGANIZATION DISPLAY.

           Older versions of the HTML may still contain a hardcoded
           school block. Do not rely on a specific class or ID.
        --------------------------------------------------------- */
        function hideOldGenericSchoolBlocks() {
            const root = modalElement.querySelector(".modal-content") || modalElement;
            const nodes = Array.from(root.querySelectorAll("*")).reverse();

            nodes.forEach(function(element) {
                if (bulkRegistrationInfo && bulkRegistrationInfo.contains(element)) {
                    return;
                }

                const text = String(element.textContent || "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toUpperCase();

                if (
                    text === "SCHOOL / ORGANIZATION" ||
                    text === "SCHOOL / ORGANIZATION -" ||
                    text === "SCHOOL/ORGANIZATION" ||
                    text === "SCHOOL/ORGANIZATION -"
                ) {
                    /* Hide the containing row when possible. */
                    let target = element;
                    for (let i = 0; i < 3 && target.parentElement; i++) {
                        const parentText = String(target.parentElement.textContent || "")
                            .replace(/\s+/g, " ")
                            .trim()
                            .toUpperCase();

                        if (
                            parentText === "SCHOOL / ORGANIZATION" ||
                            parentText === "SCHOOL / ORGANIZATION -" ||
                            parentText === "SCHOOL/ORGANIZATION" ||
                            parentText === "SCHOOL/ORGANIZATION -"
                        ) {
                            target = target.parentElement;
                        } else {
                            break;
                        }
                    }
                    target.style.display = "none";
                }
            });
        }

        hideOldGenericSchoolBlocks();

        /* ---------------------------------------------------------
           BULK DISPLAY

           Expected:
           GOJO SATORU
           ATT-BLK-SATORU1
           REGISTRATION SUMMARY
           MEOWMEOW UNIVERSITY
           HEADCOUNT 151 | PAYING 146 | FREE 5
        --------------------------------------------------------- */
        if (isBulk) {
            if (bulkRegistrationInfo) {
                bulkRegistrationInfo.style.display = "block";
            }

            const bulkSchool = String(
                (bulkInfo && bulkInfo.school) || school || ""
            ).trim();

            const headcount = Number(
                bulkInfo && bulkInfo.headcount != null
                    ? bulkInfo.headcount
                    : 0
            ) || 0;

            const free = Number(
                bulkInfo && bulkInfo.free != null
                    ? bulkInfo.free
                    : 0
            ) || 0;

            const paying = Number(
                bulkInfo && bulkInfo.payingParticipants != null
                    ? bulkInfo.payingParticipants
                    : Math.max(headcount - free, 0)
            ) || 0;

            if (modalSchool) {
                modalSchool.textContent = bulkSchool || "-";
            }

            if (modalHeadcount) {
                modalHeadcount.textContent = headcount.toLocaleString();
            }

            if (modalPaying) {
                modalPaying.textContent = paying.toLocaleString();
            }

            if (modalFree) {
                modalFree.textContent = free.toLocaleString();
            }

            /* Remove any dynamically-created individual school row. */
            const oldIndividualRow = document.getElementById("individualModalSchoolRow");
            if (oldIndividualRow) {
                oldIndividualRow.remove();
            }
        }

        /* ---------------------------------------------------------
           INDIVIDUAL DISPLAY

           Expected:
           WENCY JORDA
           DIVINE WORD COLLEGE OF CALAPAN
           ATT-IND-JORDA1
           PRESENT • timestamp

           IMPORTANT: The current HTML does NOT contain an
           individualModalSchool element. Therefore this code creates
           it dynamically instead of assuming that it exists.
        --------------------------------------------------------- */
        else {
            if (bulkRegistrationInfo) {
                bulkRegistrationInfo.style.display = "none";
            }

            const individualSchoolValue = String(school || "").trim();

            let schoolRow = document.getElementById("individualModalSchoolRow");
            let schoolValueElement = document.getElementById("individualModalSchool");

            if (!schoolRow) {
                schoolRow = document.createElement("div");
                schoolRow.id = "individualModalSchoolRow";
                schoolRow.className = "individual-school";

                schoolValueElement = document.createElement("div");
                schoolValueElement.id = "individualModalSchool";
                schoolValueElement.className = "individual-school-value";

                schoolRow.appendChild(schoolValueElement);

                /* Insert the school immediately below the attendee ID. */
                if (modalId && modalId.parentNode) {
                    modalId.parentNode.insertBefore(
                        schoolRow,
                        modalTime ? modalTime.parentNode : modalId.nextSibling
                    );
                } else if (modalName && modalName.parentNode) {
                    modalName.parentNode.insertBefore(
                        schoolRow,
                        modalName.nextSibling
                    );
                } else {
                    modalElement.appendChild(schoolRow);
                }
            }

            if (!schoolValueElement) {
                schoolValueElement = document.getElementById("individualModalSchool");
            }

            if (schoolValueElement) {
                schoolValueElement.textContent = individualSchoolValue || "-";
                schoolValueElement.style.display = "block";
                schoolValueElement.style.fontWeight = "400";
                schoolValueElement.style.marginTop = "4px";
                schoolValueElement.style.marginBottom = "4px";
            }

            schoolRow.style.display = "block";
        }

        /* ---------------------------------------------------------
           SHOW MODAL
        --------------------------------------------------------- */
        const modal = bootstrap.Modal.getOrCreateInstance(
            modalElement,
            {
                backdrop: true,
                keyboard: true,
                focus: true
            }
        );

        modal.show();

        requestAnimationFrame(function() {
            modalElement.style.zIndex = "1060";

            const backdrop = document.querySelector(".modal-backdrop");
            if (backdrop) {
                backdrop.style.zIndex = "1055";
            }
        });

    } catch (error) {
        console.error("Result modal display error:", error);

        /* Never convert a successful Sheet write into a fake error. */
        updateStatus(
            String(type || "error").toLowerCase(),
            String(status || "TRY AGAIN"),
            String(name || attendeeId || "ATTENDEE"),
            String(timestamp || getCurrentTimestamp()),
            String(message || "Check-in recorded successfully.")
        );
    }
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

    const school =
        String(
            data.school || ""
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
            message
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
            message
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