const PLAYFAB_SESSION_TICKET_KEY = "PlayFabSessionTicket";
const PLAYFAB_ENTITY_TOKEN_KEY = "PlayFabEntityToken";
const PLAYFAB_ENTITY_CUSTOM_ID_KEY = "PlayFabCustomId";

let playFabSessionData;

runOnStartup(async runtime => {
    console.log("Javascript runOnStartup, setting up PlayFab");
    PlayFab.settings.titleId = runtime.globalVars.PlayFabTittleID;
    playFabSessionData = new PlayFabDataSession(runtime);
});

/*** utility functions ***/
function PlayFabDataSession(runtime) {
    this.runtime = runtime;
    console.warn(`PlayFabDataSession constructon got runtime: ${runtime}`);

    this.getGameDataMap = function () {
        return this.runtime.objects.GameData.getFirstInstance().getDataMap();
    };

    this.getSessionTicket = function () {
        return this.getGameDataMap().get(PLAYFAB_SESSION_TICKET_KEY);
    };

    this.getCustomId = function () {
        console.log("On GetCustomId");
        const gameDataMap = this.getGameDataMap();
        console.log("gameDataMap:");

        gameDataMap.forEach(function (key, value) {
            console.log(`${key}: ${value}`)
        });

        console.log(`GetCustomID gameDataMap: ${gameDataMap.entries()}`);
        return gameDataMap.get(PLAYFAB_ENTITY_CUSTOM_ID_KEY);
    };

    this.storePlayFabSessionData = function (sessionTicket, entityToken, customId) {
        // save as global variables
        this.runtime.globalVars.PlayFabSessionTicket = sessionTicket;
        this.runtime.globalVars.PlayFabEntityToken = entityToken;
        // save in the GameData dictionary
        const gameDataMap = this.getGameDataMap();

        gameDataMap.set(PLAYFAB_SESSION_TICKET_KEY, sessionTicket);
        gameDataMap.set(PLAYFAB_ENTITY_TOKEN_KEY, entityToken);
        gameDataMap.set(PLAYFAB_ENTITY_CUSTOM_ID_KEY, customId);

        // call Construct local storage save
        this.runtime.callFunction("save_game_data");
    }
}

/*** end utility functions ***/

function LogPlayFabResultsToConsole(result, error) {
    console.log(`result: ${JSON.stringify(result)} error: ${PlayFab.GenerateErrorReport(error)}`);
}

function SubmitScore(runtime) {
    console.log("Calling submit score");
    const sessionTicket = playFabSessionData.getSessionTicket();
    console.log("Calling submit score 2");
    const score = runtime.globalVars.Score;
    console.log(`Submit score: ${score}`);
    const updateRequest = {
        SessionTicket: sessionTicket,
        Statistics: [{
            StatisticName: "Top",
            Value: score
        }]
    }
    console.log("Calling submit score 3");
    PlayFabClientSDK.UpdatePlayerStatistics(updateRequest, function (result, error) {
        LogPlayFabResultsToConsole(result, error);
        console.log("Calling submit score 4 ");
    });
    console.log("Calling submit score 5");
}

function GetLeaderboard(runtime) {
    PlayFab.settings.sessionTicket = playFabSessionData.getSessionTicket();

    const request = {
        StatisticName: "Top",
        StartPosition: 0,
        MaxResultsCount: 10
    }

    PlayFabClientSDK.GetLeaderboard(request, function (result, error) {
        LogPlayFabResultsToConsole(result, error);
    });
}

// Function to login to playfab using the customId if available
function LoginToPlayFabSilent(runtime) {
    const customId = playFabSessionData.getCustomId();
    console.log(`got CustomId: ${customId}`);
    if (typeof customId === "undefined") {
        console.log("No customId available we need the user to login.")
        return;
    }

    // try to login to playfab with customId
    const loginRequest = {
        customId: customId
    }

    PlayFabClientSDK.LoginWithCustomID(loginRequest, function (result, error) {
        LogPlayFabResultsToConsole(result, error);

        if (result !== null) {
            // If the Login was successful we save the session data
            const sessTicket = result["data"]["SessionTicket"]
            const entityToken = result["data"]["EntityToken"]["EntityToken"];
            // we have customId at the top, we logged in with that
            // Save the PlayFab Session Data in the Local Storage for future Use
            playFabSessionData.storePlayFabSessionData(sessTicket, entityToken, customId);
        }
    });
}

// Wrapper function to login to PlayFab using Email Address
function LoginToPlayFab(runtime) {
    // Get the User data from the UI
    const emailInput = runtime.objects.EmailInput.getFirstInstance();
    const passwordInput = runtime.objects.PasswordInput.getFirstInstance();
    // debugger;
    const email = emailInput.text;
    const password = passwordInput.text;

    console.log(`LoginToPlayFab: email: ${email} --- ${password}`);

    // Create the login Request For PlayFab
    const loginRequest = {
        Email: email,
        Password: password,
        InfoRequestParameters: {GetUserAccountInfo: true}
    }

    console.log(`PlayFab login request: ${JSON.stringify(loginRequest)}`);
    // Do the Login Request to PlayFab
    PlayFabClientSDK.LoginWithEmailAddress(loginRequest, function (result, error) {
        // This is the callback code after the PlayFab SDK made the request to the server
        LogPlayFabResultsToConsole(result, error);
        if (error !== null) {
            // If we got an error show the Error Dialog and return
            ShowErrorDialog(runtime, PlayFab.GenerateErrorReport(error));
            return;
        }
        if (result !== null) {
            // If the Login was successful we save the session data
            const sessTicket = result["data"]["SessionTicket"]
            const entityToken = result["data"]["EntityToken"]["EntityToken"];
            const customId = result["data"]["InfoResultPayload"]["AccountInfo"]["CustomIdInfo"]["CustomId"];

            // Save the PlayFab Session Data in the Local Storage for future Use
            playFabSessionData.storePlayFabSessionData(sessTicket, entityToken, customId);
            // exit to the previous layout (?)
            runtime.callFunction("GoPreviousLayout");
        }
    });
}

function ShowErrorDialog(runtime, error) {
    runtime.callFunction("ShowErrorDialog", error);
}

function RegisterToPlayFab(runtime) {
    // Get the Registration data from the UI
    const displayName = runtime.objects.DisplayNameInput.getFirstInstance().text;
    const email = runtime.objects.EmailInput.getFirstInstance().text;
    const username = runtime.objects.UsernameInput.getFirstInstance().text;
    const password = runtime.objects.PasswordInput.getFirstInstance().text;
    const confirmPassword = runtime.objects.ConfirmPasswordInput.getFirstInstance().text;

    console.log(`RegisterToPlayFab - displayName: ${displayName} email: ${email} username: ${username} password: ${password} confirmPassword: ${confirmPassword}`);

    // if passwords are different show an error and return
    if (password !== confirmPassword) {
        let msg = `passwords do not match: ${password} != ${confirmPassword}`;
        console.log(msg);
        ShowErrorDialog(runtime, "Passwords do not match.");
        return;
    }

    // Create the registration request
    const registerRequest = {
        DisplayName: displayName,
        Email: email,
        Password: password,
        RequireBothUsernameAndEmail: false,
        Username: username
    };

    console.log(`PlayFab register request: ${JSON.stringify(registerRequest)}`);

    // Make the call to the PlayFab SDK for registering the user with Email
    PlayFabClientSDK.RegisterPlayFabUser(registerRequest, function (result, error) {
        // this is the callback af
        LogPlayFabResultsToConsole(result, error);
        if (error !== null) {
            // if there was an error show the Error Dialog and then return
            ShowErrorDialog(runtime, PlayFab.GenerateErrorReport(error));
            return;
        }
        if (result !== null) {
            // We don't want to ask the user to login every time so we will link with a CustomID
            // Get the session data to link with it
            const sessTicket = result["data"]["SessionTicket"]
            const entityToken = result["data"]["EntityToken"]["EntityToken"];
            // Generate an unique ID
            const customId = uuidv4();
            console.log(`Created new customId: ${customId}`);
            // Create the request
            const custIdRequest = {
                CustomId: customId,
                ForceLink: true, // this will replace any other custom id linking
                EntityToken: entityToken
            }

            // make the call to link with custom ID, we shouldn't care of the return.
            PlayFabClientSDK.LinkCustomID(custIdRequest, function (result, error) {
                LogPlayFabResultsToConsole(result, error);
            });

            playFabSessionData.storePlayFabSessionData(sessTicket, entityToken, customId);
            // exit to the previous layout (?)
            runtime.callFunction("GoPreviousLayout");
        }
    });
}

