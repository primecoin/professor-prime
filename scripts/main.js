const PLAYFAB_SESSION_TICKET_KEY = "PlayFabSessionTicket";
const PLAYFAB_ENTITY_TOKEN_KEY = "PlayFabEntityToken";
const PLAYFAB_ENTITY_CUSTOM_ID_KEY = "PlayFabCustomId";
const PLAYFAB_USERNAME_KEY = "PlayFabUsername";

let playFabSessionData;

runOnStartup(async runtime => {
    console.log("Javascript runOnStartup, setting up PlayFab");
    PlayFab.settings.titleId = runtime.globalVars.PlayFabTittleID;
    playFabSessionData = new PlayFabDataSession(runtime);
});

/*** utility functions ***/
function PlayFabDataSession(runtime) {
    this.runtime = runtime;

    console.warn(`PlayFabDataSession constructon got runtime: ${JSON.stringify(runtime)}`);

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

    this.storeCustomGameData = function (key, value) {
        this.getGameDataMap().set(key, value);
        this.runtime.callFunction("save_game_data");
    }

    this.getCustomGameData = function (key) {
        return this.getGameDataMap().get(key);
    }
}

function getPlayFabSessionTicket(result) {
    return result["data"]["SessionTicket"];
}

function getPlayFabCustomId(result) {
    return result["data"]["InfoResultPayload"]["AccountInfo"]["CustomIdInfo"]["CustomId"];
}

function getPlayFabEntityToken(result) {
    return result["data"]["EntityToken"]["EntityToken"];
}

function getPaddedScore(score, length=6) {
    return `${score}`.padStart(length, '0');
}
/*** end utility functions ***/

function LogDataToConsole(data) {
    console.log(JSON.stringify(data));
}

function LogPlayFabResultsToConsole(result, error, prepend = '') {
    console.log(`${prepend}result: ${JSON.stringify(result)} error: ${PlayFab.GenerateErrorReport(error)}`);
}

function SubmitScore(runtime) {
    console.log("Calling submit score");
    const sessionTicket = playFabSessionData.getSessionTicket();
    if (typeof sessionTicket === "undefined") {
        console.warn("Not submitting score, sessionTicket is undefined");
    }
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
        LogPlayFabResultsToConsole(result, error, "UpdatePlayerStatistics: ");
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
        LogPlayFabResultsToConsole(result, error, "GetLeaderboard: ");
        if (result !== null) {
            const leaderboardText = runtime.objects.Leaderboard.getFirstInstance();
            const leaderboardList = result["data"]["Leaderboard"];
            console.log(`leaderboardList ${JSON.stringify(leaderboardList)}`);
            let entryText = '';
            for (let i = 0; i < leaderboardList.length; i++) {
                let entry = leaderboardList[i];
                console.log(`entry: ${i} - ${JSON.stringify(entry)}`);
                let score = entry["StatValue"];
                score = getPaddedScore(score);
                let position = getPaddedScore(i+1, 2);
                entryText += `${position} - ${score} - ${entry["DisplayName"]}\n`;
                console.log(`entryText: ${entryText}`);
            }
            console.log(`final entryText: ${entryText}`);
            leaderboardText.text = entryText;
        }
        runtime.callFunction("LeaderboardDataLoaded");
    });
}

// Function to login to playfab using the customId if available
function LoginToPlayFabSilent(runtime) {
    let customId = playFabSessionData.getCustomId();
    console.log(`got CustomId: ${customId}`);

    if (typeof customId === "undefined") {
        console.log("No customId available we need the user to login.")
        // console.log("Create a new custom Id so the player logs in anonymously.")
        return;
        // customId = uuidv4();
    }

    // try to login to PlayFab with customId
    const loginRequest = {
        CustomId: customId
        // CreateAccount: true
    }

    PlayFabClientSDK.LoginWithCustomID(loginRequest, function (result, error) {
        LogPlayFabResultsToConsole(result, error, "LoginWithCustomID: ");

        if (result !== null) {
            // If the Login was successful we save the session data
            const sessTicket = getPlayFabSessionTicket(result);
            const entityToken = getPlayFabEntityToken(result);
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
        LogPlayFabResultsToConsole(result, error, "LoginWithEmailAddress: ");
        if (error !== null) {
            // If we got an error show the Error Dialog and return
            ShowErrorDialog(runtime, PlayFab.GenerateErrorReport(error));
            return;
        }
        if (result !== null) {
            // If the Login was successful we save the session data
            const sessTicket = getPlayFabSessionTicket(result);
            const entityToken = getPlayFabEntityToken(result);
            const customId = getPlayFabCustomId(result);

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
        console.warn(msg);
        ShowErrorDialog(runtime, "Passwords do not match.");
        return;
    }

    if (!displayName) {
        let msg = `Please provide a Display Name`;
        console.warn(msg);
        ShowErrorDialog(runtime, msg);
        return;
    }

    // Create the registration request
    const registerRequest = {
        DisplayName: displayName,
        Email: email,
        Password: password,
        Username: username
    };
    //
    // console.log(`PlayFab register request: ${JSON.stringify(registerRequest)}`);
    //
    // PlayFabClientSDK.AddUsernamePassword(registerRequest, function(result, error){
    //     LogPlayFabResultsToConsole(result, error, "AddUsernamePassword: ");
    //     if(error !== null) {
    //         ShowErrorDialog(runtime, PlayFab.GenerateErrorReport(error));
    //         return;
    //     }
    //     if(result !== null) {
    //         console.log("AddUsernamePassword success, saving username.");
    //         playFabSessionData.storeCustomGameData("PlayFabUsername", username);
    //         playFabSessionData.storeCustomGameData("PlayFabHasUsername", 1);
    //         runtime.callFunction("GoPreviousLayout");
    //     }
    // });

    // Make the call to the PlayFab SDK for registering the user with Email
    PlayFabClientSDK.RegisterPlayFabUser(registerRequest, function (result, error) {
        // this is the callback af
        LogPlayFabResultsToConsole(result, error, "RegisterPlayFabUser: ");
        if (error !== null) {
            // if there was an error show the Error Dialog and then return
            ShowErrorDialog(runtime, PlayFab.GenerateErrorReport(error));
            return;
        }
        if (result !== null) {
            // We don't want to ask the user to login every time so we will link with a CustomID
            // Get the session data to link with it
            const sessTicket = getPlayFabSessionTicket(result);
            const entityToken = getPlayFabEntityToken(result);
            // Generate an unique ID
            const customId = uuidv4();
            console.log(`Created new customId: ${customId}`);
            // Create the request
            const custIdRequest = {
                CustomId: customId,
                ForceLink: true // this will replace any other custom id linking
            }

            // make the call to link with custom ID, we shouldn't care of the return.
            PlayFabClientSDK.LinkCustomID(custIdRequest, function (result, error) {
                LogPlayFabResultsToConsole(result, error, "LinkCustomID: ");
            });

            playFabSessionData.storePlayFabSessionData(sessTicket, entityToken, customId);
            // exit to the previous layout (?)
            runtime.callFunction("GoPreviousLayout");
        }
    });
}

