const PLAYFAB_SESSION_TICKET_KEY = "PlayFabSessionTicket";
const PLAYFAB_ENTITY_TOKEN_KEY = "PlayFabEntityToken";

runOnStartup(async runtime => {
    console.log("Javascript runOnStartup, setting up PlayFab");
    PlayFab.settings.titleId = runtime.globalVars.PlayFabTittleID;
});

function StorePlayFabSessionData(runtime, sessionTicket, entityToken) {
    // const sessionTicket = result["data"]["SessionTicket"];
    // const entityToken = result["data"]["EntityToken"]["EntityToken"];
    // save as global variables
    runtime.globalVars.PlayFabSessionTicket = sessionTicket;
    runtime.globalVars.PlayFabEntityToken = entityToken;
    // save in the GameData dictionary
    const gameDataMap = runtime.objects.GameData.getFirstInstance().getDataMap();
    gameDataMap.set(PLAYFAB_SESSION_TICKET_KEY, sessionTicket);
    gameDataMap.set(PLAYFAB_ENTITY_TOKEN_KEY, entityToken);
    runtime.callFunction("save_game_data");
    runtime.callFunction("GoPreviousLayout");
}

function GetSessionTicket(runtime) {
    const gameDataMap = runtime.objects.GameData.getFirstInstance().getDataMap();
    return gameDataMap.get(PLAYFAB_SESSION_TICKET_KEY);
}

function SubmitScore(runtime) {
    console.log("Calling submit score");
    PlayFab.settings.sessionTicket = GetSessionTicket(runtime);
    console.log("Calling submit score 2");
    const updateRequest = {
        StatisticName: "Top",
        Value: runtime.globalVars.Score
    }
    console.log("Calling submit score 3");
    PlayFabClientSDK.UpdatePlayerStatistics(updateRequest, function (result, error) {
        debugger;
        console.log(`UpdatePlayerStatistics result: ${JSON.stringify(result)} error: ${JSON.stringify(error)}`);
        console.log("Calling submit score 4 ");
    });
    console.log("Calling submit score 5");
}

function GetLeaderboard(runtime) {
    PlayFab.settings.sessionTicket = GetSessionTicket(runtime);

    const request = {
        StatisticName: "Top",
        StartPosition: 0,
        MaxResultsCount: 10
    }

    PlayFabClientSDK.GetLeaderboard(request, function (result, error) {
        console.log(`GetLeaderBoard result: ${JSON.stringify(result)} error: ${JSON.stringify(error)}`);
    });
}

function LoginToPlayFab(runtime) {
    const emailInput = runtime.objects.EmailInput.getFirstInstance();
    const passwordInput = runtime.objects.PasswordInput.getFirstInstance();
    // debugger;
    const email = emailInput.text;
    const password = passwordInput.text;

    console.log(`LoginToPlayFab: email: ${email} --- ${password}`);

    const loginRequest = {
        Email: email,
        Password: password,
        InfoRequestParameters: {GetUserAccountInfo: true, GetUserData: true, GetPlayerProfile: true}
    }
    console.log(`PlayFab login request: ${JSON.stringify(loginRequest)}`);
    PlayFabClientSDK.LoginWithEmailAddress(loginRequest, function (result, error) {
        console.log(`LoginWithEmailAddress callback called with result: ${JSON.stringify(result)} - ${JSON.stringify(error)}`);
        if (error !== null) {
            ShowErrorDialog(runtime, PlayFab.GenerateErrorReport(error));
            return;
        }
        if (result !== null) {
            const sessTicket = result["data"]["SessionTicket"]
            const entityToken = result["data"]["EntityToken"]["EntityToken"];

            StorePlayFabSessionData(runtime, sessTicket, entityToken);
        }
    });
}

function ShowErrorDialog(runtime, error) {
    runtime.callFunction("ShowErrorDialog", error);
}

function RegisterToPlayFab(runtime) {//, displayName, email, username, password, confirmPassword) {
    const displayName = runtime.objects.DisplayNameInput.getFirstInstance().text;
    const email = runtime.objects.EmailInput.getFirstInstance().text;
    const username = runtime.objects.UsernameInput.getFirstInstance().text;
    const password = runtime.objects.PasswordInput.getFirstInstance().text;
    const confirmPassword = runtime.objects.ConfirmPasswordInput.getFirstInstance().text;

    console.log(`RegisterToPlayFab - displayName: ${displayName} email: ${email} username: ${username} password: ${password} confirmPassword: ${confirmPassword}`);

    if (password !== confirmPassword) {
        let msg = `passwords do not match: ${password} != ${confirmPassword}`;
        console.log(msg);
        ShowErrorDialog(runtime, "Passwords do not match.");
        return;
    }

    const registerRequest = {
        DisplayName: displayName,
        Email: email,
        Password: password,
        RequireBothUsernameAndEmail: false,
        Username: username
    };

    console.log(`PlayFab register request: ${JSON.stringify(registerRequest)}`);

    PlayFabClientSDK.RegisterPlayFabUser(registerRequest, function (result, error) {
        console.log(`LoginWithEmailAddress callback called with result: ${JSON.stringify(result)} - ${JSON.stringify(error)}`);
        if (error !== null) {
            ShowErrorDialog(runtime, PlayFab.GenerateErrorReport(error));
            return;
        }
        if (result !== null) {
            // link with custom ID

            const sessTicket = result["data"]["SessionTicket"]
            const entityToken = result["data"]["EntityToken"]["EntityToken"];

            const uuid = uuidv4();
            const custIdRequest = {
                CustomId: uuid,
                ForceLink: true,
                EntityToken: entityToken
            }

            PlayFabClientSDK.LinkCustomID(custIdRequest, function (result, error) {
                console.log(`LinkCustomID callback called with result: ${JSON.stringify(result)} - ${JSON.stringify(error)}`);
            });

            StorePlayFabSessionData(result, sessTicket, entityToken);
        }
    });
}

