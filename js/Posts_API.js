
class Posts_API {
    static Host_URL() { return "http://localhost:5000"; }
    static API_URL() { return this.Host_URL() + "/api/posts" };

    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
    }
    static setHttpErrorState(xhr) {
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    static async HEAD() {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL(),
                type: 'HEAD',
                contentType: 'text/plain',
                complete: data => { resolve(data.getResponseHeader('ETag')); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Get(id = null) {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + (id != null ? "/" + id : ""),
                complete: data => { resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON }); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async GetQuery(queryString = "") {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + queryString,
                complete: data => {
                    resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON });
                },
                error: (xhr) => {
                    Posts_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    static async Save(data, create = true) {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: create ? this.API_URL() : this.API_URL() + "/" + data.Id,
                type: create ? "POST" : "PUT",
                contentType: 'application/json',
                data: JSON.stringify(data),
                success: (data) => { resolve(data); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Delete(id) {
        return new Promise(resolve => {
            $.ajax({
                url: this.API_URL() + "/" + id,
                type: "DELETE",
                complete: () => {
                    Posts_API.initHttpState();
                    resolve(true);
                },
                error: (xhr) => {
                    Posts_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    
//voir dans server.js, il ny a pas de post login de mis dans le serveur etrange
//C'EST LE TOKEN QUON SAVE
//faut faire un retrieve remove et add de session storage (SET, GET , REMOVE)
//quand on login, on l<ajoute

/*static async GetUser(id = null) {
    Posts_API.initHttpState();
    return new Promise(resolve => {
        $.ajax({
            url: this.Host_URL_URL() + "accounts" +(id != null ? "/" + id : ""),
            complete: data => { resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON }); },
            error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
        });
    });
}*/
    static SetConnectedToken(token){
        this.RemoveConnectedToken();
        sessionStorage.setItem("connectedUserToken", token);
    }

    static SetConnectedUser(token){
        this.RemoveConnectedUser();
        sessionStorage.setItem("connectedUser", JSON.stringify(token.User));
    }
    static setConnectedUser(user){
        this.RemoveConnectedUser();
        sessionStorage.setItem("connectedUser", JSON.stringify(user));
    }

    static GetConnectedToken(){
        let token = sessionStorage.getItem("connectedUserToken");
        return token;
    }

    static GetConnectedUser(){
        let user = JSON.parse(sessionStorage.getItem("connectedUser"));
        return user;
    }

    static RemoveConnectedToken(){
        sessionStorage.removeItem("connectedUserToken");
    }
    static RemoveConnectedUser(){
        sessionStorage.removeItem("connectedUser");
    }

    static Register(user){
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/register",
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(user),
                success: (data) => { resolve(data); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    } 

    static ModifyUser(user){
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/modify",
                type: "PUT",
                contentType: 'application/json',
                data: JSON.stringify(user),
                success: (data) => { 
                    this.setConnectedUser(data)
                    resolve(data); 
                },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
   
    static Login(user){
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/token",
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(user),
                success: (data) => {  
                    //temps dexpiration
                    this.SetConnectedToken(data);
                    this.SetConnectedUser(data);  
                    resolve(data); 
                },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }

    static Verify(id, code){
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/verify?id=" + id + "&code=" + code,
                type: "GET",
                contentType: 'application/json',
                success: (data) => {  
                    //temps dexpiration
                    //Posts_API.Logout(this.GetConnectedUser);
                    //en attendant que logout fonctionne pas
                    //this.RemoveConnectedUser();
                    this.setConnectedUser(data);
                    resolve(data); 
                },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
//pas de data jpense
    static Logout(user){
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/logout?userId=" + user.Id,
                type: "GET",
                contentType: 'application/json',
                data: JSON.stringify(user),
                success: (data) => { 
                    this.RemoveConnectedToken(data);
                    this.RemoveConnectedUser(data);  
                    resolve(data); 
                },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }

    static DeleteUser(id){
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/remove/" + id,
                type: "GET",
                contentType: 'application/json',
                success: (data) => { 
                    resolve(data);
                },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }

   
}