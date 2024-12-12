////// Author: Nicolas Chourot
////// 2024
//////////////////////////////

const periodicRefreshPeriod = 2;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

let categories = [];
let selectedCategory = "";
let currentETag = "";
let currentPostsCount = -1;
let periodic_Refresh_paused = false;
let postsPanel;
let itemLayout;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;
let connectedUser = null;

Init_UI();
async function Init_UI() {
    postsPanel = new PageManager('postsScrollPanel', 'postsPanel', 'postSample', renderPosts);
    $('#createPost').on("click", async function () {
        showCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts();
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $("#showSearch").on('click', function () {
        toogleShowKeywords();
        showPosts();
    });

    installKeywordsOnkeyupEvent();
    await showPosts();
    start_Periodic_Refresh();
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {

    $("#searchKeys").on('keyup', function () {
        clearTimeout(keywordsOnchangeTimger);
        keywordsOnchangeTimger = setTimeout(() => {
            cleanSearchKeywords();
            showPosts(true);
        }, keywordsOnchangeDelay);
    });
    $("#searchKeys").on('search', function () {
        showPosts(true);
    });
}
function cleanSearchKeywords() {
    /* Keep only keywords of 3 characters or more */
    let keywords = $("#searchKeys").val().trim().split(' ');
    let cleanedKeywords = "";
    keywords.forEach(keyword => {
        if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
    });
    $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
    $("#hiddenIcon").hide();
    $("#showSearch").show();
    if (showKeywords) {
        $("#searchKeys").show();
    }
    else
        $("#searchKeys").hide();
}
function hideSearchIcon() {
    $("#hiddenIcon").show();
    $("#showSearch").hide();
    $("#searchKeys").hide();
}
function toogleShowKeywords() {
    showKeywords = !showKeywords;
    if (showKeywords) {
        $("#searchKeys").show();
        $("#searchKeys").focus();
    }
    else {
        $("#searchKeys").hide();
        showPosts(true);
    }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function intialView() {
    connectedUser = Posts_API.GetConnectedUser();
    if(connectedUser == null){
        $("#createPost").hide();
    }
    else{
        $("#createPost").show();
    }
    $("#hiddenIcon").hide();
    $("#hiddenIcon2").hide();
    $('#menu').show();
    $('#commit').hide();
    $('#abort').hide();
    $('#form').hide();
    $('#form').empty();
    $('#aboutContainer').hide();
    $('#errorContainer').hide();
    showSearchIcon();
}
async function showPosts(reset = false) {
    intialView();
    $("#viewTitle").text("Fil de nouvelles");
    periodic_Refresh_paused = false;
    await postsPanel.show(reset);
}
function hidePosts() {
    postsPanel.hide();
    hideSearchIcon();
    $("#createPost").hide();
    $('#menu').hide();
    periodic_Refresh_paused = true;
}
function showForm() {
    hidePosts();
    $('#form').show();
    $('#commit').show();
    $('#abort').show();
}
function showError(message, details = "") {
    hidePosts();
    $('#form').hide();
    $('#form').empty();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#commit').hide();
    $('#abort').show();
    $("#viewTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").empty();
    $("#errorContainer").append($(`<div>${message}</div>`));
    $("#errorContainer").append($(`<div>${details}</div>`));
}

function showCreatePostForm() {
    showForm();
    $("#viewTitle").text("Ajout de nouvelle");
    renderPostForm();
}
function showEditPostForm(id) {
    showForm();
    $("#viewTitle").text("Modification");
    renderEditPostForm(id);
}
function showDeletePostForm(id) {
    showForm();
    $("#viewTitle").text("Retrait");
    renderDeletePostForm(id);
}
function showEditUserForm(id){
    showForm();
    $("#viewTitle").text("Modification du profil");
    renderUserForm(id);
}

function showDeleteUserForm(id){
    showForm();
    $("#viewTitle").text("Suppression du profil");
    renderDeleteUserForm(id)
}
function showLogin()
{
    showForm();
    $('#commit').hide();
    renderLoginForm();
}

function showSignup(){
    showForm();
    $('#commit').hide();
    renderUserForm();
}

function showVerify()
{
    showForm();
    $('#commit').hide();
    $('#abort').hide();
    renderVerifyForm();
}

function showModify(id){
    showForm();
    $('#commit').hide();
    renderUserForm(id);
}
function showAbout() {
    hidePosts();
    $("#hiddenIcon").show();
    $("#hiddenIcon2").show();
    $('#abort').show();
    $("#viewTitle").text("À propos...");
    $("#aboutContainer").show();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {
    $("#reloadPosts").addClass('white');
    $("#reloadPosts").on('click', async function () {
        $("#reloadPosts").addClass('white');
        postsPanel.resetScrollPosition();
        await showPosts();
    })
    setInterval(async () => {
        if (!periodic_Refresh_paused) {
            let etag = await Posts_API.HEAD();
            // the etag contain the number of model records in the following form
            // xxx-etag
            let postsCount = parseInt(etag.split("-")[0]);
            if (currentETag != etag) {           
                if (postsCount != currentPostsCount) {
                    console.log("postsCount", postsCount)
                    currentPostsCount = postsCount;
                    $("#reloadPosts").removeClass('white');
                } else
                    await showPosts();
                currentETag = etag;
            }
        }
    },
        periodicRefreshPeriod * 1000);
}
async function renderPosts(queryString) {
    let endOfData = false;
    queryString += "&sort=date,desc";
    compileCategories();
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    if (showKeywords) {
        let keys = $("#searchKeys").val().replace(/[ ]/g, ',');
        if (keys !== "")
            queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ',')
    }
    addWaitingGif();
    let response = await Posts_API.Get(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        currentPostsCount = parseInt(currentETag.split("-")[0]);
        let Posts = response.data;
        if (Posts.length > 0) {
            Posts.forEach(Post => {
                postsPanel.append(renderPost(Post));
            });
        } else
            endOfData = true;
        linefeeds_to_Html_br(".postText");
        highlightKeywords();
        attach_Posts_UI_Events_Callback();
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function renderPost(post) {
    
    let date = convertToFrenchDate(UTC_To_Local(post.Date));
    let crudIcon = "";
    

    if(post.Likes == null){
        post.Likes = [];
    }
    console.log
    //un users pas connecté ne peut pas like les postes
    //ni voir les nombre de like
    if(connectedUser != null){

        if (connectedUser.isAdmin || connectedUser.Id == post.Creator.Id) {
            crudIcon +=`
                <span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier nouvelle"></span>
                <span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer nouvelle"></span>
            `;
        }
        if(connectedUser.isSuper || connectedUser.isAdmin)
        {

            if (post.Likes.includes(connectedUser.Id))
            {
                crudIcon += `
                    <span class="likeCmd cmdIconSmall fa fa-thumbs-up" postId="${post.Id}" title="J'aime"></span>
                `;
            } else {
                crudIcon += `
                    <span class="likeCmd cmdIconSmall fa fa-thumbs-o-up" postId="${post.Id}" title="J'aime"></span>
                `;
            }
            crudIcon += `
                <span className="likeCount">${post.Likes.length}</span>
           `;

        }
    }

    return $(`
        <div class="post" id="${post.Id}">
            <div class="postHeader">
                ${post.Category}
                ${crudIcon}
            </div>
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class="postOwnerAndDate">
                <div class="ownerLayout"> 
                <div class="UserAvatarXSmall" style="background-image:url('${post.Creator.Avatar}')"></div>
                 <div>${post.Creator.Name}</div>

                </div>
                <div class="postDate"> ${date} </div>
            </div>
            
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Réduire..."></span>
            </div>         
        </div>
    `);
}
async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            if (!categories.includes(selectedCategory))
                selectedCategory = "";
            updateDropDownMenu(categories);
        }
    }
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    if(connectedUser != null){
        DDMenu.append($(`
            <div class="userContainer">
                 <div class="UserAvatarXSmall" style="background-image:url('${connectedUser.Avatar}')"></div>
                 <div>${connectedUser.Name}</div>
            </div>
            `));
        DDMenu.append($(`<div class="dropdown-divider"></div> `));
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="modifyCmd">
                <i class="menuIcon fa fa-pencil-square mx-2"></i> Modifier Votre Profil
            </div>
            `));
        DDMenu.append($(`
                <div class="dropdown-item menuItemLayout" id="logoutCmd">
                    <i class="menuIcon fa fa-sign-out mx-2"></i> Déconnexion
                </div>
                `));
    }
    else{
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout" id="loginCmd">
                <i class="menuIcon fa fa-sign-in-alt mx-2"></i> Connexion
            </div>
            `));
    }
  
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        showAbout();
    });

    $('#loginCmd').on("click", function () {
        showLogin();
    });

    
    $('#modifyCmd').on("click", function () {
        //à modifier, faut prendre le id lololol mais ca marche
        showModify(3);
    });
    //ici faire les deux bouton
    $('#logoutCmd').on("click", function () {
        Posts_API.Logout(connectedUser);
        connectedUser = null;
        
        //mettre ces chose la dans logout quand logout va fonctionner
      /*  Posts_API.RemoveConnectedToken(connectedUser);
        Posts_API.RemoveConnectedUser(connectedUser); */
        showLogin();
    });
    $('#modifyCmd').on("click", function () {
        //showModify(connecteduser.id);
    });

    $('#allCatCmd').on("click", async function () {
        selectedCategory = "";
        await showPosts(true);
        updateDropDownMenu();
    });
    $('.category').on("click", async function () {
        selectedCategory = $(this).text().trim();
        await showPosts(true);
        updateDropDownMenu();
    });
}
function attach_Posts_UI_Events_Callback() {

    linefeeds_to_Html_br(".postText");
    // attach icon command click event callback
    $(".editCmd").off();
    $(".editCmd").on("click", function () {
        showEditPostForm($(this).attr("postId"));
    });
    $(".deleteCmd").off();
    $(".deleteCmd").on("click", function () {
        showDeletePostForm($(this).attr("postId"));
    });

    //utiliser la meme methode que le prof pour rajouter les like
    //toggle le like button
    $(".likeCmd").off();
    $(".likeCmd").on("click",async function () {
        let postId = $(this).attr("postId");

        toggleLikeButton(postId, connectedUser);
        showPosts();
    });

    $(".moreText").off();
    $(".moreText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).show();
        $(`.lessText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('showExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('hideExtra');
    })
    $(".lessText").off();
    $(".lessText").click(function () {
        $(`.commentsPanel[postId=${$(this).attr("postId")}]`).hide();
        $(`.moreText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        postsPanel.scrollToElem($(this).attr("postId"));
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('hideExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('showExtra');
    })
}
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        postsPanel.itemsPanel.append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////
async function toggleLikeButton(postId, user) {
    let postResponse = await Posts_API.Get(postId);
    let likeCmd = $(`.likeCmd[postId=${postId}]`);
    let post = postResponse.data;

    console.log(post);
    //on s'assure que le array est pas vide
    if (!post.Likes) {
        post.Likes = [];
    }

    console.log(user.Id);
    const isLikedByUser = post.Likes.includes(user.Id);

    //on retire le user de l'array si il a deja like le post
    if (isLikedByUser) {
        let userIndex = post.Likes.indexOf(user.Id);
        post.Likes.splice(userIndex, 1);
        likeCmd.removeClass('fa-thumbs-up');
        likeCmd.addClass('fa-thumbs-o-up');

        let imageUrl = post.Image.split('/').pop();
        post.Image = imageUrl;

        //on ajoute le user dans l'array si il a pas like le post
    } else {
        post.Likes.push(user.Id);
        likeCmd.removeClass('fa-thumbs-o-up');
        likeCmd.addClass('fa-thumbs-up');
    }

    await Posts_API.Save(post, false);
}

function linefeeds_to_Html_br(selector) {
    $.each($(selector), function () {
        let postText = $(this);
        var str = postText.html();
        var regex = /[\r\n]/g;
        postText.html(str.replace(regex, "<br>"));
    })
}
function highlight(text, elem) {
    text = text.trim();
    if (text.length >= minKeywordLenth) {
        var innerHTML = elem.innerHTML;
        let startIndex = 0;

        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var index = normalizedHtml.indexOf(text, startIndex);
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else
                startIndex = innerHTML.length + 1;
        }
        elem.innerHTML = innerHTML;
    }
}
function highlightKeywords() {
    if (showKeywords) {
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                let titles = document.getElementsByClassName('postTitle');
                Array.from(titles).forEach(title => {
                    highlight(key, title);
                })
                let texts = document.getElementsByClassName('postText');
                Array.from(texts).forEach(text => {
                    highlight(key, text);
                })
            })
        }
    }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
    $('#commit').show();
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            showError("Post introuvable!");
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let post = response.data;
        if (post !== null) {
            let date = convertToFrenchDate(UTC_To_Local(post.Date));
            $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
            linefeeds_to_Html_br(".postText");
            // attach form buttons click event callback
            $('#commit').on("click", async function () {
                await Posts_API.Delete(post.Id);
                if (!Posts_API.error) {
                    await showPosts();
                }
                else {
                    console.log(Posts_API.currentHttpError)
                    showError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", async function () {
                await showPosts();
            });

        } else {
            showError("Post introuvable!");
        }
    } else
        showError(Posts_API.currentHttpError);
}
function newPost() {
    let Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Image = "news-logo-upload.png";
    Post.Category = "";
   // Post.Likes = new Array();

    console.log("Title : " + Post.Title);
    console.log("Text : " + Post.Text);
    console.log("Image : " + Post.Image.toString());
    console.log("Category : " + Post.Category);
   // console.log("Likes : " + Post.Likes.length);
    return Post;
}
function renderPostForm(post = null) {
    let create = post == null;
    if (create) post = newPost();
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
             <input type="hidden" name="Date" value="${post.Date}"/>
            <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de création </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
    if (create) $("#keepDateControl").hide();

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!

    $("#commit").click(function () {
        $("#commit").off();
        return $('#savePost').trigger("click");
    });
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        post.Creator = connectedUser;
        if (post.Category != selectedCategory)
            selectedCategory = "";
        if (create || !('keepDate' in post))
            post.Date = Local_to_UTC(Date.now());
        delete post.keepDate;
        post = await Posts_API.Save(post, create);
        if (!Posts_API.error) {
            await showPosts();
            postsPanel.scrollToElem(post.Id);
        }
        else
            showError("Une erreur est survenue! ", Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function getFormData($form) {
    // prevent html injections
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    // grab data from all controls
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}

/////////////////////// USER ///////////////////////////////////////////////////////
//sessionStorage
function renderLoginForm(){
    $("#viewTitle").text("Connexion");
    $("#emailError").text("");
    $("#passwordError").text("");
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        
        <span id="RegisterMessage" style="font-size: 1.5em; display: block; margin-bottom: 10px;">
        </span>
        <form class="form" id="loginForm">            
            <div class="form-group">
            <input 
                class="form-control Email"
                name="Email"
                id="Email"
                placeholder="Courriel"
                required
                RequireMessage="Veuillez entrer votre courriel" 
                InvalidMessage="Veuillez entrer un courriel valide"
                value=""
            />
            <span id="emailError" style="color: red; font-size: 0.9em;"></span>
            <input 
                type="password"
                class="form-control Password"
                name="Password"
                id="Password"
                placeholder="Mot de passe"
                required
                RequireMessage="Veuillez entrer votre mot de passe" 
                InvalidMessage="Veuillez entrer un mot de passe valide"
                value=""
            />
            <span id="passwordError" style="color: red; font-size: 0.9em;"></span>
            </div>
           <br>
            <input type="submit" value="Connexion" id="login" class="btn btn-primary">
            <div class="dropdown-divider"></div>
            <input type="button" value="Inscription" id="signup" class="btn btn-secondary">
        </form>
    `);
    initFormValidation(); // important do to after all html injection!
    $('#loginForm').on("submit", async function (event) {
        $("#emailError").text("");
        $("#passwordError").text("");
        event.preventDefault();
        let user = getFormData($("#loginForm"));
        let conUser;
        let con = await Posts_API.Login(user);
       
        /*if(conUser == undefined){
            con = await Posts_API.Login(user);
            console.log(con);
            
        }*/
            //Posts_API.SetConnectedToken(con);
            //Posts_API.SetConnectedUser(con);
        //A ARRANGER,,, LE VERIFIER MAARCHE, MAIS PAS FAIRE UIN LOGIN, SEULEMENT PRENDRE LE USER DANS LA BD...DEMANDER AU PROF
        if (!Posts_API.error){
           
           // console.log("CONNECTED USER === " + conUser.User.VerifyCode);
           /*if(con != null){
              conUser = con.User;
           }*/
          conUser = Posts_API.GetConnectedUser();
          console.log(conUser);
           
            if(conUser.VerifyCode != "verified"){
                showVerify();
            }else{
                connectedUser = conUser;
                showPosts();
            }
            
        }
        else{
            if(Posts_API.currentStatus == 480){
                //non verifier
                $("#emailError").text("Email non vérifier");
            }
            else if(Posts_API.currentStatus == 481){
                //user not found
                $("#emailError").text("Email inexistant");
            }
            else if(Posts_API.currentStatus == 482){
                //mot de passe incorrect
                $("#passwordError").text("Mot de passe incorrect");
            }
        }
    });
    $('#signup').on("click", async function () {
        showSignup();
    });
}

//à demander au prof, comment le token focntionne, car pour la verification, il faut recupere le login, donc le id du login avec le token jcomprend rien
function renderVerifyForm(){
    $("#viewTitle").text("Vérification");
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        
        <span id="RegisterMessage" style="font-size: 1.5em; display: block; margin-bottom: 10px;">
        Veuillez entrer le code de vérification que vous avez reçu par courriel.
        </span>
        <form class="form" id="verifyForm">
            <input 
                class="form-control"
                name="Verify"
                id="Verify"
                placeholder="Code de vérification"
                required
                RequireMessage="Veuillez entrer un code" 
                value=""
            />
            <span id="verifyError" style="color: red; font-size: 0.9em;"></span>
           <br>
            <input type="submit" value="Vérifier" id="verify" class="btn btn-primary">
        </form>
    `);
    initFormValidation(); // important do to after all html injection!
    $('#verifyForm').on("submit", async function (event) {
        event.preventDefault();
        let code = $("#Verify").val();
        let user = Posts_API.GetConnectedUser();
        let test = await Posts_API.Verify(user.Id, code);
        if (!Posts_API.error){
            console.log(test);
            Posts_API.setConnectedUser(test);
            connectedUser = Posts_API.GetConnectedUser();
            showPosts();
        }
           // renderPosts();
        else
          $("#verifyError").text("Code de vérification incorrect");

    });
}


//À FAIRE
function renderDeleteUserForm(){
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        
        <span id="RegisterMessage" style="font-size: 1.5em; display: block; margin-bottom: 10px;">
        Voulez-vous vraiment effacer votre compte?
        </span>
        <form class="form" id="deleteForm">
            
            <input type="submit" value="Effacer Mon Compte" id="verify" class="btn btn-primary">
            <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
        </form>
    `);
    initFormValidation(); // important do to after all html injection!
    $('#deleteForm').on("submit", async function (event) {
        event.preventDefault();
        let user = Posts_API.GetConnectedUser();
        Posts_API.Logout(user.Id);
        await Posts_API.DeleteUser(user.Id);
        if (!Posts_API.error){
            showPosts();
        }
           // renderPosts();
        else
        showError("Une erreur est survenue! ", Posts_API.currentHttpError);

    });
    $('#cancel').on("click", async function () {
        showPosts();
    });
}
//va falloir faire le edit pour le account pis le delete aussi

function newUser() {
    let User = {};
    User.Id = 0;
    User.Name = "";
    User.Email = "";
    User.Password = "";
    User.Authorizations = {
        writeAccess: 0,
        readAccess: 0
    };
    
    //ici faut faire en sorte que created = la date  créer
    return User;
}

function renderUserForm(id = null) {
    hidePosts();
    let create = id == null;
    let user;
    if (create) {
        user = newUser();
        user.Avatar = "no-avatar.png";

    }else{
        user = Posts_API.GetConnectedUser();
    }
    $("#viewTitle").text(create ? "Création d'un compte" : "Modification du profil");
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="userForm">
            <input type="hidden" name="Id" value="${user.Id}"/>
            <input type="hidden" name="writeauthorizations" value="${user.Authorizations.writeAccess}"/>
            <input type="hidden" name="readauthorizations" value="${user.Authorizations.readAccess}"/>

            <div class="form-group">
            <label for="Email" class="form-label">Courriel </label>
            <input 
                class="form-control Email"
                name="Email"
                id="Email"
                placeholder="Courriel"
                required
                RequireMessage="Veuillez entrer votre courriel" 
                InvalidMessage="Veuillez entrer un courriel valide"
                value="${user.Email}"
            />
            <input 
                class="form-control Email"
                name="ConfirmEmail"
                id="ConfirmEmail"
                placeholder="Vérification"
                required
                RequireMessage="Veuillez entrer votre courriel" 
                InvalidMessage="Veuillez entrer un courriel valide"
                value="${user.Email}"
            />
             <span class="error" id="confirmEmailError" style="color: red; "></span>
            </div>
             <div class="form-group">
             
             <label for="Password" class="form-label">Mot de passe </label>
            <input 
                type="password"
                class="form-control Password"
                name="Password"
                id="Password"
                placeholder="Mot de passe"
                required
                RequireMessage="Veuillez entrer votre mot de passe" 
                InvalidMessage="Veuillez entrer un mot de passe valide"
                value="${user.Password}"
                
            />
            <input 
                type="password"
                class="form-control Password"
                name="PasswordVerification"
                id="PasswordVerification"
                placeholder="Vérification"
                required
                RequireMessage="Veuillez entrer votre mot de passe" 
                InvalidMessage="Veuillez entrer un mot de passe valide"
                value="${user.Password}"
            />
            <span class="error" id="confirmPasswordError" style="color: red; "></span>
            </div>
            <label for="Name" class="form-label">Nom </label>
            <input 
                class="form-control Alpha"
                name="Name" 
                id="Name" 
                placeholder="Nom"
                required
                RequireMessage="Veuillez entrer un nom"
                InvalidMessage="Le nom comporte un caractère illégal" 
                value="${user.Name}"
            />
           
            <!-- nécessite le fichier javascript 'imageControl.js' -->
            <label class="form-label">Avatar </label>
            <div   class='imageUploader' 
                   newImage='${create}' 
                   controlId='Avatar' 
                   imageSrc='${user.Avatar}' 
                   waitingImage="Loading_icon.gif">
            </div>
            <hr>
            <input type="submit" value="Enregistrer" id="saveUser" class="btn btn-primary">
            <input type="button" value="Effacer Compte" id="cancel" class="btn btn-secondary">
        </form>
    `);
  
    initImageUploaders();
    //faut faire en sorte que le email n'est pas deja utilisé demander au prof
    //addConflictValidation();
    initFormValidation(); 
    if(create){
        $("#cancel").hide();
    }
    $('#userForm').on("submit", async function (event) {
        event.preventDefault();
        
        let isValid = true;
        if ($("#Email").val() !== $("#ConfirmEmail").val()) {
            $("#confirmEmailError").text("Les courriels ne correspondent pas.");
            isValid = false;
        } else {
            $("#confirmEmailError").text("");
        }
    
        if ($("#Password").val() !== $("#PasswordVerification").val()) {
            $("#confirmPasswordError").text("Les mots de passe ne correspondent pas.");
            isValid = false;
        } else {
            $("#confirmPasswordError").text("");
        }
       
        if(isValid){
            let user = getFormData($("#userForm"));
            user.authorizations = {
                writeAccess : user.writeauthorizations,
                readAccess : user.readauthorizations
            };
            delete user.writeauthorizations;
            delete user.readauthorizations;
            delete user.ConfirmEmail;
            delete user.PasswordVerification;
            if(create){
                delete user.authorizations;
                user.Created = Local_to_UTC(Date.now());
                await Posts_API.Register(user);
            }
            else{
                user.Created = Local_to_UTC(Date.now());
                if(user.Password == "************")
                    user.Password = '';
                await Posts_API.ModifyUser(user);
            }
            
            if (!Posts_API.error){
                if(create){
                    $("#RegisterMessage").text = "Votre compte a été créé. Veuillez réccupérer votre code de vérification dans vos courriels, on vous le demandera à la prochaine connexion!"
                    showLogin();
                }else{
                    connectedUser = Posts_API.GetConnectedUser();
                    console.log(connectedUser.VerifyCode);
                    if(connectedUser.VerifyCode != "verified"){
                        showLogin();
                    }
                    else{
                        showPosts();
                    }
                    
                }
                
            }
            else{
                if(Posts_API.currentStatus == 409){
                    //non verifier
                    $("#confirmEmailError").text("Un compte est déjà relié à cet Email");
                }
                else{
                    showError("Une erreur est survenue! " + Posts_API.currentHttpError);
                }
            }
        }
        
    });
    $('#cancel').on("click", async function () {
        renderDeleteUserForm();
    });

}

function renderEditUserForm(id){

}


//pour faire la page de gestion dusager, faire comme tp session passer cad de faire une liste avec tous les usages et ils ont 3 points a droite de leur image et non, le premier c'est
//l'option de changer les droit donc en clicant ca va faire promote de accountcontroller , un truc bloquer qui va faire block de account controller et l'autre truc jspu c koi 

//httpcontext, apiserver, router,,,, tracer
//localhostblabla/token