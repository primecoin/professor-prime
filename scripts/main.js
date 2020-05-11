runOnStartup(async runtime =>
{
    console.log("Javascript runOnStartup, setting up PlayFab");
    PlayFab.settings.titleId = runtime.globalVars.PlayFabTittleID;
});

function LoginToPlayFab(runtime, email, password) {
    const loginRequest = {
        Email: email,
        Password: password
    }
    console.log(`PlayFab login request: ${loginRequest}`);
    PlayFabClientSDK.LoginWithEmailAddress(loginRequest, function(result, error) {
        console.log(`LoginWithEmailAddress callback called with result: ${result} - ${error}`);
        if(error !== null) {
            runtime.callFunction("ShowErrorDialog", PlayFab.GenerateErrorReport(error));
        }
    });
}

function RegisterToPlayFab(displayName, email, password, username) {
    const registerRequest = {
        DisplayName: displayName,
        Email: email,
        Password: password,
        RequireBothUsernameAndEmail: false,
        TitleId: runtime.glovalVars.PlayFabTittleID,
        Username: username
    };
    console.log(`PlayFab register request: ${registerRequest}`);

    PlayFabClientSDK.RegisterPlayFabUser(registerRequest, function (result, error) {
        console.log(`RegisterPlayFabUser callback called with result: ${result} - ${error}`);
    });
}