/* =========================================================
   CODE GREEN 2026
   8th MIMAROPA Regional IT Congress
   Check-In Frontend
========================================================= */


/* =========================================================
   SIMPLE SETUP
   This part holds the app link and the basic values it needs.
========================================================= */

const DEPLOYED_WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbyLseZj1D40TxYwQXd87Kbcj78Zqhp8kKljXEwciCuFXlJXtGw_li5FmsxAcWyQeKr1Hw/exec";


/* =========================================================
   GLOBAL VALUES
   These are the app's main "memory" items while it is running.
========================================================= */

let html5QrCode = null;

let isProcessing = false;

let lastScannedCode = "";

let lastScanTime = 0;

const SCAN_COOLDOWN = 2500;


// This stops the same QR code from sending repeated requests
// before the first one is finished.
let isQrCheckInProcessing = false;

/* =========================================================
   ATTENDEE DIRECTORY FALLBACK
   This is the app's backup list.
   If the scan result is missing a name or school,
   it can still look up the same attendee information from the sheet.
========================================================= */


let attendeeDirectory = [];

// This loads the list of people so the app can match names and schools faster.
function loadAttendeeDirectory() {
    fetch(DEPLOYED_WEB_APP_URL + "?action=attendees", {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    })
    .then(list => {
        if (Array.isArray(list)) {
            attendeeDirectory = list.map(item => ({
                id: String(item.id || "").trim().toUpperCase(),
                name: String(item.name || "").trim(),
                school: String(item.school || "").trim(),
                isBulk:
                    item.isBulk === true ||
                    String(item.isBulk || "").toLowerCase() === "true" ||
                    String(item.isBulk || "") === "1"
            })).filter(item => item.id);

            console.log("Attendee directory loaded:", attendeeDirectory.length);
        }
    })
    .catch(error => {
        console.warn("Attendee directory fallback unavailable:", error);
    });
}

function findAttendeeById(attendeeId) {
    // Clean the ID so the match is not affected by extra spaces or lowercase letters.
    const cleanId = String(attendeeId || "").trim().toUpperCase();

    if (!cleanId || !Array.isArray(attendeeDirectory) || attendeeDirectory.length === 0) {
        return null;
    }

    return attendeeDirectory.find(item => {
        if (!item) return false;
        const itemId = String(item.id || item.attendeeId || "").trim().toUpperCase();
        return itemId === cleanId;
    }) || null;
}

// If the result has no school, this gives it a fallback school name.
function resolveSchoolName(rawSchool, directoryRecord, fallback = "School Not Specified") {
    const directSchool = String(rawSchool || "").trim();
    if (directSchool) return directSchool;

    const directorySchool = directoryRecord ? String(directoryRecord.school || "").trim() : "";
    if (directorySchool) return directorySchool;

    return fallback || "";
}


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
   APP START
   This runs when the page is ready.
========================================================= */

window.addEventListener("load", () => {

    // Load the attendee list first so the app can match names later.
    loadAttendeeDirectory();

    // Turn on the QR camera reader.
    initializeScanner();

    // Connect buttons and keyboard actions.
    setupEvents();

    // Prepare the result popup after each scan.
    setupResultModalEvents();

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
   CONTINUE SCANNING
========================================================= */

function setupResultModalEvents() {

    const resultModal =
        document.getElementById("resultModal");

    if (!resultModal) {
        return;
    }


    const continueButton =
        resultModal.querySelector(".modal-action");

    if (!continueButton) {
        return;
    }


    continueButton.addEventListener(
        "click",
        async function () {

            console.log(
                "CONTINUE SCANNING clicked."
            );


            /*
             * Reset all scan locks immediately.
             */

            isProcessing = false;

            isQrCheckInProcessing = false;

            lastScannedCode = "";

            lastScanTime = 0;

            clearInput();


            /*
             * Give Bootstrap time to finish
             * closing the result modal.
             */

            setTimeout(
                async () => {

                    console.log(
                        "Resetting QR scanner..."
                    );


                    /*
                     * STOP EXISTING SCANNER
                     */

                    if (html5QrCode) {

                        try {

                            if (
                                html5QrCode.isScanning
                            ) {

                                console.log(
                                    "Stopping existing QR scanner..."
                                );

                                await html5QrCode.stop();

                            }

                        }

                        catch (error) {

                            console.warn(
                                "Scanner stop warning:",
                                error
                            );

                        }


                        /*
                         * CLEAR EXISTING SCANNER
                         */

                        try {

                            await html5QrCode.clear();

                        }

                        catch (error) {

                            console.warn(
                                "Scanner clear warning:",
                                error
                            );

                        }


                        /*
                         * Remove old scanner instance.
                         */

                        html5QrCode = null;

                    }


                    /*
                     * START A COMPLETELY NEW SCANNER
                     */

                    console.log(
                        "Starting fresh QR scanner..."
                    );


                    initializeScanner();

                },
                300
            );

        }
    );

}

/* =========================================================
   QR SCANNER
========================================================= */

function initializeScanner() {

    // If a camera is already running, do not start another one.
    if (
        html5QrCode
    ) {

        console.log(
            "QR scanner instance already exists."
        );

        return;

    }

    // This checks if the QR library is available before using it.
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

    // This creates the actual scanner object that reads the code.
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

    const now = Date.now();

    // This is a safety check: if one scan is already being processed,
    // ignore the repeated reads that may come in right away.
    if (isQrCheckInProcessing) {

        console.log(
            "QR detection ignored: check-in request already processing."
        );

        return;
    }


    /*
     * Additional cooldown protection.
     */
    if (
        decodedText === lastScannedCode &&
        now - lastScanTime < SCAN_COOLDOWN
    ) {

        console.log(
            "QR detection ignored: cooldown active."
        );

        return;
    }


    /*
     * Record this scan immediately.
     */
    lastScannedCode = decodedText;
    lastScanTime = now;


    /*
     * Lock QR processing BEFORE calling the server.
     */
    isQrCheckInProcessing = true;


    // ---------------------------------------------------------
    // GET THE ATTENDEE ID FROM THE QR CODE
    // ---------------------------------------------------------

    let attendeeId =
        String(decodedText || "").trim();


    /*
     * Some QR codes include extra text with the ID inside parentheses.
     * Example:
     * "Maria Rivera (ATT-BLK-RIVERA2)"
     * becomes:
     * "ATT-BLK-RIVERA2"
     */
    const match = attendeeId.match(/\((.*?)\)/);


    if (
        match &&
        match[1]
    ) {

        attendeeId =
            match[1]
                .trim()
                .toUpperCase();

    } else {

        attendeeId =
            attendeeId.toUpperCase();

    }


    // ---------------------------------------------------------
    // VALIDATE
    // ---------------------------------------------------------

    if (!attendeeId) {

        isQrCheckInProcessing = false;

        return;

    }


    // ---------------------------------------------------------
    // DISPLAY ID
    // ---------------------------------------------------------

    if (searchInput) {

        searchInput.value =
            attendeeId;

    }


    console.log(
        "QR CODE DETECTED:",
        attendeeId
    );

    console.log(
        "CALLING processCheckIn(), NOT processManualOverride()"
    );


    // ---------------------------------------------------------
    // NORMAL QR CHECK-IN
    // ---------------------------------------------------------

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

    // This is the main check-in action: send the ID and the chosen station to the server.
    console.log(
        "✅ processCheckIn() CALLED:",
        attendeeId
    );

    const selectedSession =
        getSelectedStation();

    console.log(
        "QR SCAN REQUEST:",
        {
            action: "scan",
            attendeeId: attendeeId,
            session: selectedSession
        }
    );


    /* -----------------------------------------------------
       BEFORE SENDING, CHECK THAT THE DATA IS COMPLETE
    ----------------------------------------------------- */

    if (!attendeeId) {

        console.error(
            "No attendee ID supplied."
        );

        return;
    }


    if (!selectedSession) {

        console.error(
            "No station selected."
        );

        return;
    }


    /* -----------------------------------------------------
       PREVENT DUPLICATE REQUESTS
    ----------------------------------------------------- */

    if (isProcessing) {

        console.log(
            "Check-in request already processing."
        );

        return;
    }


    isProcessing = true;

    setProcessingState(true);


    /* -----------------------------------------------------
       SEND THE CHECK-IN REQUEST TO THE SERVER
    ----------------------------------------------------- */

    fetch(
        DEPLOYED_WEB_APP_URL,
        {
            method: "POST",
            redirect: "follow",

            headers: {
                "Content-Type":
                    "text/plain;charset=utf-8"
            },

            body: JSON.stringify({
                action: "scan",
                attendeeId: attendeeId,
                session: selectedSession
            })
        }
    )

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `HTTP Server Error ${response.status}`
            );
        }

        return response.text();

    })

    .then(text => {

        console.log(
            "Apps Script response:",
            text
        );


        /* -------------------------------------------------
           DETECT APPS SCRIPT HTML ERROR PAGE
        ------------------------------------------------- */

        if (
            text.trim().startsWith("<!DOCTYPE") ||
            text.includes("<html")
        ) {

            throw new Error(
                "Server execution timeout. Please try again."
            );
        }


        let result;


        /* -------------------------------------------------
           PARSE JSON
        ------------------------------------------------- */

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
                "Invalid response format received from server."
            );
        }


        /* -------------------------------------------------
           HANDLE RESPONSE
        ------------------------------------------------- */

        handleResponse(result);

    })

    .catch(error => {

        console.error(
            "Check-in request failed:",
            error
        );


        const timestamp =
            typeof getCurrentTimestamp === "function"
                ? getCurrentTimestamp()
                : "";


        const errorMessage =
            error.message ||
            "Unable to process scan.";


        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            timestamp,
            errorMessage
        );


        showResultModal(
            "error",
            "TRY AGAIN",
            "",
            attendeeId,
            timestamp,
            errorMessage
        );


        finishProcessing();

    });

}

/* =========================================================
   HANDLE RESPONSE
========================================================= */

function handleResponse(res) {

    // This is where the app reads the server's answer and turns it into something the screen can show.
    console.log("Processed result:", res);


    /* =====================================================
       CLEAN AND NORMALIZE THE SERVER RESPONSE
    ===================================================== */

    const data =
        res &&
        res.result &&
        typeof res.result === "object"
            ? res.result
            : res;


    /* =====================================================
       INVALID RESPONSE
    ===================================================== */

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
            "The check-in server returned an invalid response.",
            null,
            ""
        );

        finishProcessing();

        return;
    }


    /* =====================================================
       BASIC RESPONSE VALUES
    ===================================================== */

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


    const rawMessage =
        String(
            data.message ||
            data.text ||
            ""
        )
        .trim();


    /* =====================================================
   SERVER REGISTRATION FALLBACK
===================================================== */

const serverRegistration =
    data.registration &&
    typeof data.registration === "object"
        ? data.registration
        : {};


/* =====================================================
   NAME
===================================================== */

let name =
    String(
        data.name ||
        data.fullName ||
        data.fullname ||
        serverRegistration.fullName ||
        serverRegistration.name ||
        ""
    )
    .trim();


/* =====================================================
   ATTENDEE ID
===================================================== */

let attendeeId =
    String(
        data.attendeeId ||
        data.id ||
        serverRegistration.groupId ||
        serverRegistration.attendeeId ||
        serverRegistration.id ||
        ""
    )
    .trim();


    /* =====================================================
       FALLBACK PARSER FOR OLD RESPONSES

       Example:

       [SUCCESS] JOHN DOE (ATT-123) marked PRESENT.
    ===================================================== */

    if (
        !name ||
        !attendeeId
    ) {

        const match =
            rawMessage.match(
                /\[(?:SUCCESS|ALREADY|ERROR|ALREADY_PROCESSED)\]\s+(.*?)\s+\((.*?)\)/i
            );


        if (match) {

            if (!name) {
                name =
                    match[1].trim();
            }

            if (!attendeeId) {
                attendeeId =
                    match[2].trim();
            }
        }
    }


    /* =====================================================
       DIRECTORY FALLBACK
    ===================================================== */

    const safeAttendeeId =
        attendeeId
            .toUpperCase();


    const directoryRecord =
        safeAttendeeId
            ? findAttendeeById(
                safeAttendeeId
            )
            : null;


    /* =====================================================
       FINAL NAME

       Backend has priority.
    ===================================================== */

    name =
        String(
            data.name ||
            data.fullName ||
            data.fullname ||
            (
                directoryRecord &&
                directoryRecord.name
            ) ||
            name ||
            ""
        )
        .trim();


    /* =====================================================
       SCHOOL

       IMPORTANT:

       Backend Column F has priority.

       Directory is only fallback.
    ===================================================== */

    const school =
    String(
        data.school ||
        data.schoolName ||
        serverRegistration.school ||
        serverRegistration.schoolName ||
        (
            directoryRecord &&
            directoryRecord.school
        ) ||
        ""
    )
    .trim();


    /* =====================================================
       TIMESTAMP
    ===================================================== */

    const timestamp =
        String(
            data.timestamp ||
            ""
        )
        .trim();


    /* =====================================================
       MESSAGE
    ===================================================== */

    /* ---------------------------------------------------------
        FRIENDLY USER-FACING MESSAGE
    --------------------------------------------------------- */

    const selectedSession = getSelectedStation();

    let message = rawMessage || "Please try again.";

    if (status === "SUCCESS") {

        if (selectedSession === "ATTENDANCE") {
            message = "Attendance recorded successfully.";
        }

        else if (selectedSession === "AM_SNACK") {
            message = "AM Snack claimed successfully.";
        }

        else if (selectedSession === "PM_SNACK") {
            message = "PM Snack claimed successfully.";
        }

    }

    else if (
        status === "ALREADY_SCANNED" ||
        status === "ALREADY_PROCESSED"
    ) {

        if (selectedSession === "ATTENDANCE") {
            message = "Attendance has already been recorded.";
        }

        else if (selectedSession === "AM_SNACK") {
            message = "AM Snack has already been claimed.";
        }

        else if (selectedSession === "PM_SNACK") {
            message = "PM Snack has already been claimed.";
        }

    }


    /* =====================================================
       BULK INFORMATION

       IMPORTANT:

       This section appears ONLY ONCE.

       No attendee-ID prefix checking.
    ===================================================== */

    const serverBulkInfo =
        data.bulkInfo &&
        typeof data.bulkInfo === "object"
            ? data.bulkInfo
            : null;


    /* =====================================================
       DETERMINE BULK STATUS
    ===================================================== */

    const bulkFlag =
    data.isBulk === true ||

    (
        serverBulkInfo &&
        serverBulkInfo.isBulk === true
    ) ||

    serverRegistration.isBulk === true ||

    String(
        data.isBulk || ""
    ).toLowerCase() === "true" ||

    (
        serverBulkInfo &&
        String(
            serverBulkInfo.isBulk || ""
        ).toLowerCase() === "true"
    ) ||

    String(
        serverRegistration.isBulk || ""
    ).toLowerCase() === "true" ||

    String(
        data.isBulk || ""
    ) === "1" ||

    (
        serverBulkInfo &&
        String(
            serverBulkInfo.isBulk || ""
        ) === "1"
    ) ||

    String(
        serverRegistration.isBulk || ""
    ) === "1";


    let bulkInfo = null;

if (bulkFlag) {

    bulkInfo = {

        isBulk: true,

        /* ---------------------------------------------
           SCHOOL
           Backend value comes from Column F
        --------------------------------------------- */

        school:
            String(
                data.school ||
                data.schoolName ||
                (
                    serverBulkInfo &&
                    serverBulkInfo.school
                ) ||
                ""
            )
            .trim(),


        /* ---------------------------------------------
           HEADCOUNT
           Backend value comes from Column M
        --------------------------------------------- */

        headcount:
            Number(
                data.headcount ??
                data.headCount ??
                (
                    serverBulkInfo &&
                    serverBulkInfo.headcount
                ) ??
                (
                    data.registration &&
                    data.registration.headcount
                ) ??
                0
            ),


        /* ---------------------------------------------
           FREE PARTICIPANTS
           Backend value comes from Column N
        --------------------------------------------- */

        free:
            Number(
                data.free ??
                data.freeParticipants ??
                (
                    serverBulkInfo &&
                    serverBulkInfo.free
                ) ??
                (
                    serverBulkInfo &&
                    serverBulkInfo.freeParticipants
                ) ??
                (
                    data.registration &&
                    data.registration.free
                ) ??
                0
            ),


        /* ---------------------------------------------
           PAYING PARTICIPANTS
           
           IMPORTANT:
           DO NOT CALCULATE THIS IN THE FRONTEND.

           The backend already calculates:
               HEADCOUNT - FREE

           The frontend only receives and displays it.
        --------------------------------------------- */

        payingParticipants:
            Number(
                data.payingParticipants ??
                data.payee ??
                (
                    serverBulkInfo &&
                    serverBulkInfo.payingParticipants
                ) ??
                (
                    serverBulkInfo &&
                    serverBulkInfo.payee
                ) ??
                (
                    data.registration &&
                    data.registration.payingParticipants
                ) ??
                (
                    data.registration &&
                    data.registration.payee
                ) ??
                0
            )

    };
}


    /* =====================================================
       DEBUG
    ===================================================== */

    console.log(
        "========== SERVER RESPONSE =========="
    );

    console.log(
        data
    );

    console.log(
        "NAME:",
        name
    );

    console.log(
        "SCHOOL:",
        school
    );

    console.log(
        "IS BULK:",
        bulkFlag
    );

    console.log(
        "BULK INFO:",
        bulkInfo
    );


    /* =====================================================
       REGISTRATION OBJECT
    ===================================================== */

    const registration = {

        ...serverRegistration,

        groupId:
            attendeeId,

        fullName:
            name,

        certificateName:
            data.certificateName ||
            serverRegistration.certificateName ||
            "",

        email:
            data.email ||
            serverRegistration.email ||
            "",

        contact:
            data.contact ||
            serverRegistration.contact ||
            "",

        school:
            school,

        attendance:
            data.attendanceStatus ||
            serverRegistration.attendance ||
            "",

        attendanceTime:
            data.attendanceTime ||
            serverRegistration.attendanceTime ||
            "",

        amSnack:
            data.amSnack ||
            serverRegistration.amSnack ||
            "",

        amSnackTime:
            data.amSnackTime ||
            serverRegistration.amSnackTime ||
            "",

        pmSnack:
            data.pmSnack ||
            serverRegistration.pmSnack ||
            "",

        pmSnackTime:
            data.pmSnackTime ||
            serverRegistration.pmSnackTime ||
            "",

        headcount:
            bulkInfo
                ? bulkInfo.headcount
                : 0,

        free:
            bulkInfo
                ? bulkInfo.free
                : 0,

        payee:
            bulkInfo
                ? bulkInfo.payingParticipants
                : 0
    };


    /* =====================================================
       FINAL NORMALIZED RESPONSE
    ===================================================== */

    const normalizedResponse = {

        status:
            status,

        displayStatus:
            displayStatus,

        name:
            name,

        attendeeId:
            attendeeId,

        school:
            school,

        timestamp:
            timestamp,

        message:
            message,

        isBulk:
            bulkFlag,

        bulkInfo:
            bulkInfo,

        registration:
            registration

    };


    console.log(
        "Normalized scan response:",
        normalizedResponse
    );


    /* =====================================================
       GOOD RESULT: SUCCESS
    ===================================================== */

    if (
        status === "SUCCESS"
    ) {

        playSound("success");


        const safeName =
            name ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
        formatModalTimestamp(
            timestamp || getCurrentTimestamp()
        );


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


    /* =====================================================
       THIS PERSON WAS ALREADY RECORDED

       Supported values:
       ALREADY_SCANNED
       ALREADY_PROCESSED
    ===================================================== */

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
        formatModalTimestamp(
            timestamp || getCurrentTimestamp()
        );


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


        /* =====================================================
       BLOCKED OR DENIED
       This means the person cannot do this action yet.
    ===================================================== */

    if (
        status === "BLOCKED" ||
        status === "DENIED"
    ) {

        playSound("error");


        const safeName =
            name ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
            formatModalTimestamp(
                timestamp || getCurrentTimestamp()
            );


        /* -------------------------------------------------
           FRIENDLY USER-FACING BLOCKED MESSAGE
           
           Do NOT display the raw backend message.
           ------------------------------------------------- */

        let safeMessage =
            "This check-in cannot be processed yet.";


        if (
            selectedSession === "AM_SNACK"
        ) {

            safeMessage =
                "Attendance must be recorded first.";

        }

        else if (
            selectedSession === "PM_SNACK"
        ) {

            safeMessage =
                "AM Snack must be claimed first.";

        }


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
            bulkInfo,
            school
        );


        finishProcessing();

        return;
    }

    /* =====================================================
       INVALID / UNKNOWN ERROR
    ===================================================== */

    playSound("error");


    const safeName =
        name ||
        attendeeId ||
        "ATTENDEE";


    const safeTimestamp =
    formatModalTimestamp(
        timestamp || getCurrentTimestamp()
    );


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
        bulkInfo,
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

    // This part fills the popup with the final result: success, duplicate, or error.

    const modalElement =
        document.getElementById("resultModal");

    if (!modalElement) {
        console.error(
            "Result modal element not found."
        );
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


    /* -----------------------------------------------------
       INDIVIDUAL SCHOOL
    ----------------------------------------------------- */

    const individualSchool =
        document.getElementById(
            "individualSchoolDisplay"
        ) ||
        modalElement.querySelector(
            ".individual-school"
        );

    const individualModalSchool =
        document.getElementById(
            "individualModalSchool"
        );


    /* -----------------------------------------------------
       BULK REGISTRATION INFORMATION
    ----------------------------------------------------- */

    const bulkRegistrationInfo =
        document.getElementById(
            "bulkRegistrationInfo"
        );

    const modalSchool =
        document.getElementById(
            "modalSchool"
        );

    const modalHeadcount =
        document.getElementById(
            "modalHeadcount"
        );

    const modalPaying =
        document.getElementById(
            "modalPaying"
        );

    const modalFree =
        document.getElementById(
            "modalFree"
        );


    /* -----------------------------------------------------
       NORMALIZE BASIC DATA
    ----------------------------------------------------- */

    const safeType =
        String(
            type || "error"
        ).toLowerCase();

    const safeStatus =
        String(
            status || "TRY AGAIN"
        );

    const safeName =
        String(
            name ||
            "ATTENDEE NOT IDENTIFIED"
        );

    const safeId =
        String(
            attendeeId ||
            "NO ATTENDEE ID"
        );

    const safeTimestamp =
    formatModalTimestamp(
        timestamp || getCurrentTimestamp()
    );

    const safeMessage =
        String(
            message ||
            "Please try again."
        );


    /* -----------------------------------------------------
       RESET MODAL STYLE
    ----------------------------------------------------- */

    modalElement.classList.remove(
        "modal-success",
        "modal-already",
        "modal-error"
    );


    /* -----------------------------------------------------
       STATUS TYPE
    ----------------------------------------------------- */

    if (
        safeType === "success"
    ) {

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

    else if (
        safeType === "already"
    ) {

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
       POPULATE BASIC ATTENDEE INFORMATION
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


    /* =====================================================
       CHECK WHETHER THIS RESULT IS FOR A BULK REGISTRATION
       The app only trusts the backend information for this.
    ===================================================== */

    const isBulk =
        bulkInfo &&
        (
            bulkInfo.isBulk === true ||
            String(
                bulkInfo.isBulk || ""
            ).toLowerCase() === "true" ||
            String(
                bulkInfo.isBulk || ""
            ) === "1"
        );


    /* =====================================================
       ALWAYS RESET BOTH SECTIONS FIRST
       This keeps the popup clean between scans.
       Example: one result may be bulk, the next may be individual.
    ===================================================== */

    if (bulkRegistrationInfo) {
        bulkRegistrationInfo.style.display =
            "none";
    }

    if (individualSchool) {
        individualSchool.style.display =
            "none";
    }


    /* =====================================================
       BULK REGISTRATION
    ===================================================== */

    if (isBulk) {

        console.log(
            "Rendering BULK registration information:",
            bulkInfo
        );


        /* -------------------------------------------------
           SHOW BULK SUMMARY
        ------------------------------------------------- */

        if (bulkRegistrationInfo) {
            bulkRegistrationInfo.style.display =
                "block";
        }


        /* -------------------------------------------------
           SCHOOL
           
           Backend data.school should be Column F.
           
           bulkInfo.school was created from data.school
           during normalization.
        ------------------------------------------------- */

        const resolvedBulkSchool =
            String(
                bulkInfo.school ||
                school ||
                ""
            ).trim();


        if (modalSchool) {

            modalSchool.textContent =
                resolvedBulkSchool ||
                "School Not Specified";
        }


        /* -------------------------------------------------
           HEADCOUNT
           
           Column M
        ------------------------------------------------- */

        const headcount =
            Number(
                bulkInfo.headcount ??
                0
            );


        if (modalHeadcount) {

            modalHeadcount.textContent =
                headcount;
        }


        /* -------------------------------------------------
           PAYING PARTICIPANTS
           
           Column O / PAYEE
           
           IMPORTANT:
           
           DO NOT calculate:
           
               headcount - free
           
           The backend already provides PAYEE.
        ------------------------------------------------- */

        const payingParticipants =
            Number(
                bulkInfo.payingParticipants ?? 0
            );

        if (modalPaying) {

            modalPaying.textContent =
                payingParticipants;
        }


        /* -------------------------------------------------
           FREE PARTICIPANTS
           
           Column N
        ------------------------------------------------- */

        const freeParticipants =
            Number(
                bulkInfo.free ??
                0
            );


        if (modalFree) {

            modalFree.textContent =
                freeParticipants;
        }


        /* -------------------------------------------------
           MAKE SURE INDIVIDUAL SCHOOL IS HIDDEN
        ------------------------------------------------- */

        if (individualSchool) {

            individualSchool.style.display =
                "none";
        }

    }


    /* =====================================================
       INDIVIDUAL REGISTRATION
       
       IMPORTANT:
       
       There is NO registration summary.
       
       Therefore:
       
       #bulkRegistrationInfo = hidden
       
       Only the individual school is displayed.
    ===================================================== */

    else {

        console.log(
            "Rendering INDIVIDUAL registration information."
        );


        /* -------------------------------------------------
           BULK SUMMARY MUST REMAIN HIDDEN
        ------------------------------------------------- */

        if (bulkRegistrationInfo) {

            bulkRegistrationInfo.style.display =
                "none";
        }


        /* -------------------------------------------------
           SHOW INDIVIDUAL SCHOOL
        ------------------------------------------------- */

        if (individualSchool) {

            individualSchool.style.display =
                "block";
        }


        /* -------------------------------------------------
           SCHOOL MUST COME FROM THE BACKEND DATA
           
           data.school comes from Column F.
           
           The 'school' argument passed into this function
           already comes from the normalized backend response.
        ------------------------------------------------- */

        if (individualModalSchool) {

            const resolvedIndividualSchool =
                String(
                    school ||
                    ""
                ).trim();


            individualModalSchool.textContent =
                resolvedIndividualSchool ||
                "School Not Specified";
        }
    }


    /* =====================================================
       SHOW MODAL
    ===================================================== */

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


        /* -------------------------------------------------
           FORCE MODAL TO FRONT
        ------------------------------------------------- */

        requestAnimationFrame(() => {

            modalElement.style.zIndex =
                "1060";


            const backdrop =
                document.querySelector(
                    ".modal-backdrop"
                );


            if (backdrop) {

                backdrop.style.zIndex =
                    "1055";
            }

        });

    }

    catch (error) {

        console.error(
            "Unable to display result modal:",
            error
        );


        /* -------------------------------------------------
           FALLBACK
        ------------------------------------------------- */

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
    console.trace(
        "🚨 MANUAL OVERRIDE WAS TRIGGERED")

    const attendeeId = overrideAttendeeId
        ? overrideAttendeeId.value.trim().toUpperCase()
        : "";

    const pin = overridePin
        ? overridePin.value
        : "";

    const session = getSelectedStation();

    if (!attendeeId) {
        alert("Please enter an Attendee ID.");
        if (overrideAttendeeId) overrideAttendeeId.focus();
        return;
    }

    if (!pin) {
        alert("Please enter the override PIN.");
        if (overridePin) overridePin.focus();
        return;
    }

    if (!session) {
        alert("Please select a check-in station.");
        return;
    }

    if (confirmOverride) {
        confirmOverride.disabled = true;
        confirmOverride.innerHTML = `
            <i class="bi bi-arrow-repeat"></i>
            VERIFYING AUTHORIZATION...
        `;
    }

    fetch(DEPLOYED_WEB_APP_URL, {

    method: "POST",

    redirect: "follow",

    headers: {
        "Content-Type": "text/plain;charset=utf-8"
    },

    body: JSON.stringify({
        action: "manualOverride",
        attendeeId: attendeeId,
        session: session,
        pin: pin
    })

})
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP Server Error ${response.status}`);
        }
        return response.text();
    })
    .then(text => {
        console.log("Manual override response:", text);

        // Intercept Apps Script HTML crash pages before JSON parsing fails
        if (text.trim().startsWith("<!DOCTYPE") || text.includes("<html")) {
            throw new Error("Server execution timeout. Please try authorizing again.");
        }

        let result;

        try {
            result = JSON.parse(text);
        } catch (error) {
            console.error("JSON parsing failed:", error);
            throw new Error("Invalid response format received from server.");
        }

        handleOverrideResponse(result, attendeeId);
    })
    .catch(error => {
        console.error("Manual override error:", error);

        const timestamp = typeof getCurrentTimestamp === "function" ? getCurrentTimestamp() : "";
        const errorMessage = error.message || "Unable to process manual override.";

        updateStatus(
            "error",
            "TRY AGAIN",
            "",
            timestamp,
            errorMessage
        );

        showResultModal(
            "error",
            "TRY AGAIN",
            "",
            attendeeId,
            timestamp,
            errorMessage
        );
    })
    .finally(() => {
        if (confirmOverride) {
            confirmOverride.disabled = false;
            confirmOverride.innerHTML = `
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

    const safeAttendeeId = (typeof attendeeId !== "undefined" && attendeeId) 
        ? attendeeId 
        : (data && (data.attendeeId || data.id)) || "";

    const directoryRecord = safeAttendeeId ? findAttendeeById(safeAttendeeId) : null;

    const name =
        String(
            data.name ||
            data.fullName ||
            data.fullname ||
            (directoryRecord && directoryRecord.name) ||
            ""
        )
            .trim();

    const school =
        String(
            data.school ||
            data.schoolName ||
            (directoryRecord && directoryRecord.school) ||
            ""
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
            (directoryRecord && directoryRecord.name) ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
        formatModalTimestamp(
            timestamp || getCurrentTimestamp()
        );


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
            (directoryRecord && directoryRecord.name) ||
            attendeeId ||
            "ATTENDEE";


        const safeTimestamp =
        formatModalTimestamp(
            timestamp || getCurrentTimestamp()
        );


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
    formatModalTimestamp(
        timestamp || getCurrentTimestamp()
    );


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
   Small sound effects to help users know if the action worked.
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
   FORMAT MODAL TIMESTAMP
   Makes the time easier to read in the popup.
========================================================= */

function formatModalTimestamp(timestamp) {

    if (!timestamp) {
        return "";
    }

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
        return String(timestamp);
    }

    return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
    }).format(date).replace(" at ", " • ");
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