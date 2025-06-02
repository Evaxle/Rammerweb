import StrShuffler from "/lib/StrShuffler.js";
import Api from "/lib/api.js";

function setError(err) {
    const element = document.getElementById("error-text");
    if (err) {
        element.style.display = "block";
        element.textContent = "An error occurred: " + err;
    } else {
        element.style.display = "none";
        element.textContent = "";
    }
}

window.addEventListener("error", setError);

(function () {
    const api = new Api();
    const localStorageKey = "rammerhead_sessionids";
    const localStorageKeyDefault = "rammerhead_default_sessionid";

    const sessionIdsStore = {
        get() {
            const rawData = localStorage.getItem(localStorageKey);
            if (!rawData) return [];
            try {
                const data = JSON.parse(rawData);
                if (!Array.isArray(data)) throw "getout";
                return data;
            } catch (e) {
                return [];
            }
        },
        set(data) {
            if (!data || !Array.isArray(data)) throw new TypeError("must be array");
            localStorage.setItem(localStorageKey, JSON.stringify(data));
        },
        getDefault() {
            const sessionId = localStorage.getItem(localStorageKeyDefault);
            if (sessionId) {
                const data = sessionIdsStore.get();
                const filtered = data.filter(e => e.id === sessionId);
                if (filtered.length) return filtered[0];
            }
            return null;
        },
        setDefault(id) {
            localStorage.setItem(localStorageKeyDefault, id);
        }
    };

    function renderSessionTable(data) {
        const tbody = document.querySelector("tbody");
        while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

        data.forEach((session, i) => {
            const tr = document.createElement("tr");

            appendIntoTr(session.id);
            appendIntoTr(session.createdOn);

            const fillInBtn = document.createElement("button");
            fillInBtn.textContent = "Fill in existing session ID";
            fillInBtn.className = "btn btn-outline-primary";
            fillInBtn.onclick = () => {
                setError();
                sessionIdsStore.setDefault(session.id);
                loadSettings(session);
            };
            appendIntoTr(fillInBtn);

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.className = "btn btn-outline-danger";
            deleteBtn.onclick = async () => {
                setError();
                await api.deletesession(session.id);
                data.splice(i, 1);
                sessionIdsStore.set(data);
                renderSessionTable(data);
            };
            appendIntoTr(deleteBtn);

            tbody.appendChild(tr);

            function appendIntoTr(stuff) {
                const td = document.createElement("td");
                if (typeof stuff === "object" && stuff instanceof Node) {
                    td.appendChild(stuff);
                } else {
                    td.textContent = stuff;
                }
                tr.appendChild(td);
            }
        });
    }

    function loadSettings(session) {
        document.getElementById("session-id").value = session.id;
        document.getElementById("session-httpproxy").value = session.httpproxy || "";
        document.getElementById("session-shuffling").checked =
            typeof session.enableShuffling === "boolean" ? session.enableShuffling : true;
    }

    function loadSessions() {
        const sessions = sessionIdsStore.get();
        const defaultSession = sessionIdsStore.getDefault();
        if (defaultSession) loadSettings(defaultSession);
        renderSessionTable(sessions);
    }

    function addSession(id) {
        const data = sessionIdsStore.get();
        data.unshift({ id: id, createdOn: new Date().toLocaleString() });
        sessionIdsStore.set(data);
        renderSessionTable(data);
    }

    function editSession(id, httpproxy, enableShuffling) {
        const data = sessionIdsStore.get();
        for (let i = 0; i < data.length; i++) {
            if (data[i].id === id) {
                data[i].httpproxy = httpproxy;
                data[i].enableShuffling = enableShuffling;
                sessionIdsStore.set(data);
                return;
            }
        }
        throw new TypeError("cannot find " + id);
    }

    api.needpassword().then(doNeed => {
        if (doNeed) {
            document.getElementById("password-wrapper").style.display = "";
        }
    });

    window.addEventListener("load", function () {
        loadSessions();

        let showingAdvancedOptions = false;
        document.getElementById("session-advanced-toggle").onclick = function () {
            document.getElementById("session-advanced-container").style.display = (showingAdvancedOptions =
                !showingAdvancedOptions)
                ? "block"
                : "none";
        };

        document.getElementById("session-create-btn").addEventListener("click", async () => {
            setError();
            try {
                const id = await api.newsession();
                addSession(id);
                document.getElementById("session-id").value = id;
                document.getElementById("session-httpproxy").value = "";
            } catch (e) {
                setError(e);
            }
        });

        async function go() {
            setError();
            const id = document.getElementById("session-id").value;
            const httpproxy = document.getElementById("session-httpproxy").value;
            const enableShuffling = document.getElementById("session-shuffling").checked;
            const url = document.getElementById("session-url").value || "https://www.google.com/";
            if (!id) return setError("must generate a session id first");
            let value;
            try {
                value = await api.sessionexists(id);
            } catch (e) {
                return setError(e);
            }
            if (!value) return setError("session does not exist. try deleting or generating a new session");
            try {
                await api.editsession(id, httpproxy, enableShuffling);
                editSession(id, httpproxy, enableShuffling);
                const shuffleDict = await api.shuffleDict(id);
                if (!shuffleDict) {
                    window.location.href = "/" + id + "/" + url;
                } else {
                    const shuffler = new StrShuffler(shuffleDict);
                    window.location.href = "/" + id + "/" + shuffler.shuffle(url);
                }
            } catch (e) {
                setError(e);
            }
        }

        document.getElementById("session-go").onclick = go;
        document.getElementById("session-url").addEventListener("keydown", (event) => {
            if (event.key === "Enter") go();
        });
    });
})();