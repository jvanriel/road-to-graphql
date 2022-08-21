// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

class Environment {
    _host = 'https://twintag.io';
    _adminHost = '';
    _cachingHost = '';
    useCaching = false;
    _logLevel = 'none';
    autoDetect = true;
    get host() {
        this.autoDetectOrigin();
        return this._host;
    }
    set host(host) {
        this.autoDetect = false;
        this._host = host;
    }
    get adminHost() {
        this.autoDetectOrigin();
        return this._adminHost;
    }
    set adminHost(adminHost) {
        this.autoDetect = false;
        this._adminHost = adminHost;
    }
    get cachingHost() {
        this.autoDetectOrigin();
        return this._cachingHost;
    }
    set cachingHost(cachingHost) {
        this.autoDetect = false;
        this._cachingHost = cachingHost;
    }
    autoDetectOrigin() {
        if (!this.autoDetect) return;
        if (typeof window !== 'undefined' && window.location?.hostname !== "localhost" && window.location?.hostname !== "127.0.0.1") {
            this._host = window.location.origin;
        }
        const base = new URL(this._host);
        const adminSub = 'admin.';
        const cachingSub = 'cache.';
        this._adminHost = `${base.protocol}//${adminSub}${base.host}`;
        this._cachingHost = `${base.protocol}//${cachingSub}${base.host}`;
        this.autoDetect = false;
    }
    set logLevel(logLevel) {
        this._logLevel = logLevel;
    }
}
const environment = new Environment();
function setHost(host) {
    environment.host = host;
}
function setAdminHost(host) {
    environment.adminHost = host;
}
function setCachingHost(host) {
    environment.cachingHost = host;
}
function setLogLevel(logLevel) {
    environment.logLevel = logLevel;
}
const VERSION = '0.1.4';
class TwintagErrorValue {
    status = 0;
    title = '';
    detail = '';
}
class TwintagError extends Error {
    constructor(message, errors, name, stack){
        super(message);
        this.name = name || '';
        this.stack = stack;
        this.errors = errors || [];
    }
    setMessage(message) {
        this.message = message;
    }
    errors;
}
class Client {
    token;
    start = 0;
    constructor(token){
        this.token = token;
    }
    hasLoggableRequestBody(req) {
        if (!req.body) {
            return false;
        }
        const contentType = req.headers.get('Content-Type');
        if (contentType) {
            const types = [
                'application/json',
                'application/graphql',
                'application/graphql+json'
            ];
            const found = types.find((t)=>t === contentType);
            return found !== null;
        }
        return false;
    }
    logHeaders(headers) {
        for (const header of headers){
            if (header[0] !== 'authorization') {
                console.log(' ', header[0], ': ', header[1]);
            } else {
                if (header[1].startsWith('Bearer')) {
                    const beg = header[1].slice(20, 40);
                    const end = header[1].slice(header[1].length - 20, header[1].length);
                    console.log(' ', header[0], ': ', beg, '...', end);
                } else {
                    console.log(' ', header[0], ': ', header[1]);
                }
            }
        }
    }
    logRequest(req) {
        switch(environment._logLevel){
            case 'none':
                return null;
            case 'single':
                return null;
            case 'headers':
                console.log(req.method, req.url.toString());
                this.logHeaders(req.headers);
                return null;
            case 'body':
                {
                    console.log(req.method, req.url.toString());
                    this.logHeaders(req.headers);
                    if (this.hasLoggableRequestBody(req)) {
                        const tee = req.body.tee();
                        console.log(tee[0]);
                        return tee[1];
                    } else {
                        return null;
                    }
                }
        }
    }
    logResponse(req, rsp, text = '') {
        switch(environment._logLevel){
            case 'none':
                return;
            case 'single':
                console.log(req.method, req.url.toString(), rsp.statusText, `${Date.now() - this.start}ms`);
                return;
            case 'headers':
                console.log(rsp.statusText, `${Date.now() - this.start}ms`);
                this.logHeaders(req.headers);
                return;
            case 'body':
                {
                    console.log(rsp.statusText, `${Date.now() - this.start}ms`);
                    this.logHeaders(req.headers);
                    console.log(text);
                    break;
                }
        }
    }
    logError(req, rsp, text) {
        switch(environment._logLevel){
            case 'none':
                return null;
            case 'single':
                console.log(req ? req.method : '', req ? req.url.toString() : '', rsp ? rsp.statusText : 0, `${Date.now() - this.start}ms`);
                return null;
            case 'headers':
                console.log(rsp ? rsp.statusText : 0, `${Date.now() - this.start}ms`);
                if (req) {
                    for (const header of req.headers){
                        console.log(' ', header[0], ': ', header[1]);
                    }
                }
                return null;
            case 'body':
                {
                    console.log(rsp ? rsp.statusText : 0, `${Date.now() - this.start}ms`);
                    if (req) {
                        for (const header1 of req.headers){
                            console.log(' ', header1[0], ': ', header1[1]);
                        }
                    }
                    console.log(text);
                    break;
                }
        }
    }
    async do(path, args, skipParse, skipAuth) {
        this.start = Date.now();
        if (this.token && !skipAuth) {
            const headers = new Headers(args.headers);
            headers.append("Authorization", "Bearer " + this.token);
            args.headers = headers;
        }
        const headers1 = new Headers(args.headers);
        headers1.append("X-Client-Name", "twintag.js");
        headers1.append("X-Client-Version", VERSION);
        args.headers = headers1;
        let request = null;
        let response = null;
        try {
            request = new Request(path, args);
            const stream = this.logRequest(request);
            if (stream) {
                args.body = stream;
            }
            response = await fetch(request);
            if (!response.ok) {
                const json = await response.json();
                this.logResponse(request, response, json);
                const err = json;
                return [
                    {},
                    this.CreateTwintagError(err)
                ];
            }
            if (skipParse) {
                if (!response.body) {
                    this.logResponse(request, response);
                    return [
                        {},
                        undefined
                    ];
                }
                const text = await response.text();
                this.logResponse(request, response, text);
                const json1 = text.length > 0 ? JSON.parse(text) : {};
                return [
                    json1,
                    undefined
                ];
            }
            try {
                const json2 = await response.json();
                this.logResponse(request, response, json2);
                const res = json2;
                return [
                    res,
                    undefined
                ];
            } catch (error) {
                const err1 = new TwintagErrorValue();
                err1.title = 'failed to parse response';
                err1.detail = `something went wrong when parsing response; ${error}`;
                this.logError(request, response, `${err1}`);
                return [
                    {},
                    this.CreateTwintagError([
                        err1
                    ])
                ];
            }
        } catch (err2) {
            this.logError(request, response, `${err2}`);
            throw err2;
        }
    }
    async get(path, args, skipAuth) {
        if (!args) {
            args = {};
        }
        args.method = "GET";
        return await this.do(path, args, false, skipAuth);
    }
    async put(path, body, args, skipAuth) {
        if (!args) {
            args = {};
        }
        args.method = "PUT";
        if (!args.body && body) {
            args.body = JSON.stringify(body);
        }
        return await this.do(path, args, false, skipAuth);
    }
    async post(path, body, args, skipAuth) {
        if (!args) {
            args = {};
        }
        args.method = "POST";
        if (!args.body && body) {
            args.body = JSON.stringify(body);
        }
        return await this.do(path, args, false, skipAuth);
    }
    async delete(path, body, args) {
        if (!args) {
            args = {};
        }
        args.method = 'delete';
        if (!args.body && body) {
            args.body = JSON.stringify(body);
        }
        return await this.do(path, args, true);
    }
    CreateTwintagError(err) {
        if (err && err.errors && err.errors.length > 0) {
            return new TwintagError(err.errors[0].detail, err.errors[0], err.errors[0].title);
        }
        return new TwintagError("Failed to perform the request", err, "Twintag Error");
    }
}
class Parser {
    static parseSpecialTypes(data) {
        let singleInstance = false;
        if (!(data instanceof Array)) {
            singleInstance = true;
            data = [
                data
            ];
        }
        data.forEach((instance)=>{
            for(const prop in instance){
                if (prop.startsWith('$')) {
                    continue;
                }
                if (instance[`$${prop}Type`]) {
                    switch(instance[`$${prop}Type`]){
                        case 'dateTime':
                            instance[prop] = new Date(instance[prop]);
                            break;
                        default:
                            break;
                    }
                }
            }
        });
        return singleInstance ? data[0] : data;
    }
}
class FileUploader {
    signedUrl;
    instanceQid;
    fileQid;
    viewId;
    _client;
    constructor(client, viewId, signedUrl, fileQid, instanceQid){
        this._client = client;
        this.viewId = viewId;
        this.instanceQid = instanceQid;
        this.fileQid = fileQid;
        this.signedUrl = signedUrl;
    }
    async Upload(file) {
        await this.uploadFile(file);
    }
    async uploadFile(file) {
        await this.uploadToS3(this.signedUrl, file);
        await this.endUpload(this.instanceQid, this.fileQid);
    }
    async uploadToS3(uploadUrl, file) {
        const body = await file.arrayBuffer();
        return this._client.do(uploadUrl, {
            method: 'put',
            body: body
        }, true, true);
    }
    async endUpload(fileContext, fileQid) {
        let url = this.fileUrl();
        url += '/end';
        const body = {
            fileQid: fileQid,
            fileContext: fileContext
        };
        await this._client.put(url, body);
    }
    fileUrl() {
        if (this.viewId != '') {
            return environment.host + '/api/v1/views/' + this.viewId + '/data/files';
        } else {
            return environment.adminHost + '/api/v1/data/files';
        }
    }
}
class listObject {
    viewId;
    objectApiName;
    _client;
    _projectId;
    _useCaching = false;
    constructor(objectAPIName, client, viewId, projectId, useCaching = false){
        this._client = client;
        this.viewId = viewId;
        this.objectApiName = objectAPIName;
        this._projectId = projectId;
        this._useCaching = useCaching;
    }
    async get(id, lang) {
        let url = '';
        if (this._useCaching) {
            if (this.viewId == '') {
                url = `${environment.cachingHost}/data/${this.objectApiName}/${id}?schemaScope=${this._projectId}`;
            } else {
                url = `${environment.cachingHost}/api/v1/views/${this.viewId}/data/${this.objectApiName}/${id}`;
            }
        } else {
            url = this.dataUrl(id);
        }
        url += lang ? `${url.indexOf('?') < 0 ? '?' : '&'}language=${lang == 'all' ? '*' : lang}` : '';
        const [res, err] = await this._client.get(url);
        if (err) {
            err.setMessage(`failed to get data: ${err.message}`);
            throw err;
        }
        return Parser.parseSpecialTypes(res);
    }
    async insert(data) {
        const url = this.dataUrl();
        const fileTypes = this.parseForFileType(data);
        const [res, err] = await this._client.put(url, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage(`failed to insert data: ${err.message}`);
            throw err;
        }
        return await this.parseResponse(res, fileTypes);
    }
    parseForFileType(data) {
        const fileType = [];
        Object.entries(data).forEach(([key, value])=>{
            if (value && typeof value === 'object') {
                fileType.push({
                    apiName: key,
                    file: data[key]
                });
                data[key] = {
                    name: value.name,
                    size: value.size
                };
            }
        });
        return fileType;
    }
    async parseResponse(resp, fileTypes) {
        fileTypes.forEach(async (obj)=>{
            let fileResp = resp[obj.apiName];
            resp[obj.apiName] = new FileUploader(this._client, this.viewId, fileResp.uploadUrl, fileResp.metafest.fileQid, resp.$qid);
            if (obj.file instanceof Blob) {
                await resp[obj.apiName].Upload(obj.file);
                resp[obj.apiName] = fileResp.metafest;
            }
        });
        return resp;
    }
    async insertInBulk(data) {
        let url = this.dataUrl();
        url += '/import';
        const [res, err] = await this._client.put(url, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage(`failed to insert bulk data: ${err.message}`);
            throw err;
        }
        return res;
    }
    async update(data) {
        const url = this.dataUrl();
        const fileTypes = this.parseForFileType(data);
        const [res, err] = await this._client.put(url, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage(`failed to update data: ${err.message}`);
            throw err;
        }
        return this.parseResponse(res, fileTypes);
    }
    async delete(id, dataScope = '') {
        const url = this.dataUrl();
        const req = {
            id: id,
            $dataScope: dataScope
        };
        const [, err] = await this._client.delete(url, req, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage(`failed to delete data: ${err.message}`);
            throw err;
        }
    }
    async match(f, lang) {
        let filterQueryArg = this.getFilterQuery(f);
        let url = '';
        if (this._useCaching) {
            if (this.viewId == '') {
                url = `${environment.cachingHost}/data/${this.objectApiName}?schemaScope=${this._projectId}${filterQueryArg}`;
            } else {
                url = `${environment.cachingHost}/api/v1/views/${this.viewId}/data/${this.objectApiName}?${filterQueryArg}`;
            }
        } else {
            url = this.dataUrl(undefined, filterQueryArg);
        }
        url += lang ? `${url.indexOf('?') < 0 ? '?' : '&'}language=${lang == 'all' ? '*' : lang}` : '';
        const [res, err] = await this._client.get(url);
        if (err) {
            err.setMessage('failed to get data');
            throw err;
        }
        return Parser.parseSpecialTypes(res);
    }
    async getFile(instanceQID, fileQID, forceDownload = false) {
        let url = this.dataUrl(instanceQID);
        url += '/files/' + fileQID;
        if (forceDownload) {
            url += '?forcedownload=' + forceDownload;
        }
        let [res, err] = await this._client.get(url);
        if (err) {
            err.setMessage(`failed to get data: ${err.message}`);
            throw err;
        }
        if (forceDownload) {
            [res, err] = await this._client.do(res.fileURL, {
                method: 'get',
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            }, true, true);
            if (err) {
                err.setMessage(`failed to get data: ${err.message}`);
                throw err;
            }
        }
        return res;
    }
    getFilterQuery(f) {
        let filterPredicate = '';
        if (f != null) {
            for (const [objName, objectsData] of Object.entries(f)){
                if (typeof objectsData == 'object') {
                    let fe = objectsData;
                    filterPredicate += fe.gt ? this.getFilterValue(objName, fe.gt, '>') : '';
                    filterPredicate += fe.lt ? this.getFilterValue(objName, fe.lt, '<') : '';
                    filterPredicate += fe.gte ? this.getFilterValue(objName, fe.gte, '>=') : '';
                    filterPredicate += fe.lte ? this.getFilterValue(objName, fe.lte, '<=') : '';
                } else {
                    filterPredicate += `&filter=${objName}=${encodeURIComponent(this.handleTypes(objectsData))}`;
                }
            }
        }
        return filterPredicate;
    }
    getFilterValue(objName, input, op) {
        let v = this.handleTypes(input);
        if (v) {
            console.log("_________ getfilter ??? ", `&filter=${objName}${op}${encodeURIComponent(v)}`);
            return `&filter=${objName}${op}${encodeURIComponent(v)}`;
        }
        return '';
    }
    handleTypes(input) {
        switch(typeof input){
            case 'string':
            case 'number':
                {
                    return input;
                }
            default:
                {
                    if (input instanceof Date) {
                        return input.toISOString().replace('T', '%20').replace('Z', '');
                    }
                    return '';
                }
        }
    }
    dataUrl(instanceId, fp) {
        let url = '';
        if (this.viewId == '') {
            url = environment.adminHost + '/api/v1/data/' + this.objectApiName;
        } else {
            url = environment.host + '/api/v1/views/' + this.viewId + '/data/' + this.objectApiName;
        }
        if (instanceId) {
            url += '/' + instanceId;
        }
        if (fp) {
            url += `?${fp}`;
        }
        return url;
    }
}
async function createBag(qid) {
    return await createBagInternal(new Client(), undefined, qid);
}
async function createBagInternal(client, project, qid) {
    let viewReq;
    if (qid && qid != '') {
        viewReq = {
            id: qid,
            type: 'user',
            data: {
                rights: [
                    'read',
                    'list'
                ],
                isCanocical: 1
            }
        };
    } else {
        viewReq = {
            type: 'owner',
            data: undefined
        };
    }
    const path = environment.host + '/api/v1/views';
    const [data, err] = await client.put(path, viewReq);
    if (err) {
        err.setMessage(`failed to create a twintag`);
        throw err;
    }
    const view = new View(data.id);
    view._setConfig({
        project: project,
        client: client,
        data: data
    });
    return view;
}
class View {
    qid;
    _client;
    project;
    _data;
    _useCaching = false;
    constructor(qid){
        this.qid = qid;
    }
    _setConfig(init) {
        this.project = init?.project;
        this._client = init?.client;
        this._data = init?.data;
    }
    useCaching(val) {
        this._useCaching = val;
    }
    viewURL() {
        return environment.host + '/api/v1/views/' + this.qid;
    }
    twintagURL() {
        return environment.host + '/api/v1/twintags/' + this._data?.bagQid;
    }
    async client() {
        if (!this._client) {
            this._client = new Client();
        }
        if (!this._client.token) {
            const data = await this.data();
            this.setToken(data.authToken);
        }
        return this._client;
    }
    async data() {
        const data = this._data;
        if (data) {
            return data;
        }
        let client = this._client;
        if (!client) {
            client = new Client();
            this._client = client;
        }
        const [newData, err] = await client.get(this.viewURL());
        if (err) {
            err.setMessage(`failed to get twintag data`);
            throw err;
        }
        this._data = newData;
        return this._data;
    }
    setToken(token) {
        if (!this._client) {
            this._client = new Client();
        }
        this._client.token = token;
    }
    fileURL(obj, qid, op, useCachingHost = false) {
        let url = (useCachingHost && this._useCaching ? environment.cachingHost : environment.host) + '/api/v1/views/' + this.qid + '/' + obj;
        if (qid) {
            url += '/' + qid;
        }
        if (op) {
            url += '/' + op;
        }
        return url;
    }
    async fileURLUpload(obj, qid, op) {
        const data = await this.data();
        let url = this.fileURL(obj, qid, op);
        if (data.uploadsession) {
            url += '?uploadsession=' + data.uploadsession;
        }
        return url;
    }
    async upload(f, name, parent) {
        const uploadStartReq = {
            mode: 420,
            name: name ? name : f.name,
            size: f.size,
            parent: parent ? parent : undefined
        };
        let url = await this.fileURLUpload('files');
        const client = await this.client();
        const [startResp, startErr] = await client.put(url, uploadStartReq);
        if (startErr) {
            startErr.setMessage(`failed to start upload file to twintag`);
            throw startErr;
        }
        const [, uploadErr] = await client.do(startResp.uploadUrl, {
            method: 'PUT',
            body: f
        }, true, true);
        if (uploadErr) {
            uploadErr.setMessage(`failed to upload file to twintag`);
            throw uploadErr;
        }
        url = await this.fileURLUpload('files', startResp.metafest.fileQid, 'end');
        const [, endErr] = await client.do(url, {
            method: 'PUT',
            body: '{}'
        }, true);
        if (endErr) {
            endErr.setMessage(`failed to complete the file upload to twintag`);
            throw endErr;
        }
        const fileInfo = {
            FileQid: startResp.metafest.fileQid,
            Name: startResp.metafest.fileName,
            Parent: undefined,
            Size: startResp.metafest.size,
            MTime: startResp.metafest.modTime,
            FileMode: startResp.metafest.fileMode.toString()
        };
        return fileInfo;
    }
    async uploadVirtual(f, name) {
        const uploadReq = {
            mode: f.mode,
            name: name,
            size: 0,
            fileContent: f.GetDefinition()
        };
        const url = await this.fileURLUpload('virtual');
        const client = await this.client();
        const [, err] = await client.put(url, uploadReq, {}, true);
        if (err) {
            err.setMessage(`failed to upload virtual file to twintag`);
            throw err;
        }
    }
    async download(name) {
        const url = this.fileURL('web', name);
        const client = await this.client();
        const [res, err] = await client.do(url, {
            method: 'get',
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        }, true, true);
        if (err) {
            err.setMessage(`failed to download file from twintag`);
            throw err;
        }
        return res;
    }
    async downloadJSON(name) {
        const url = this.fileURL('web', name);
        const client = await this.client();
        const [res, err] = await client.get(url, {
            headers: {
                'Content-Type': 'application/json'
            }
        }, true);
        if (err) {
            err.setMessage(`failed to downlaod JSON file from twintag`);
            throw err;
        }
        return res;
    }
    async rename(source, name) {
        return await this.doMove(source, name, undefined, undefined, false);
    }
    async move(source, name, parent, view) {
        return await this.doMove(source, name, parent, view, false);
    }
    async copy(source, name, parent, view) {
        return await this.doMove(source, name, parent, view, true);
    }
    async doMove(source, name, parent, view, copy) {
        if (parent === undefined) parent = '';
        if (view === undefined) view = '';
        if (name === undefined) name = '';
        if (copy === undefined) copy = false;
        const url = this.fileURL('files/' + source.FileQid + '/move');
        const fileMoveRequest = {
            fileQid: source.FileQid,
            targetBag: view,
            targetFolder: parent,
            targetName: name,
            isCopy: copy
        };
        const client = await this.client();
        const [resp, err] = await client.put(url, fileMoveRequest);
        if (err) {
            err.setMessage(`failed to move file in twintag`);
            throw err;
        }
        return resp;
    }
    async delete(file) {
        const url = this.fileURL('files');
        const client = await this.client();
        const [, err] = await client.delete(url, [
            file.FileQid.toString()
        ]);
        if (err) {
            err.setMessage(`failed to delete file from twintag`);
            throw err;
        }
    }
    async deleteBag() {
        const url = this.viewURL();
        const client = await this.client();
        const [, err] = await client.delete(url);
        if (err) {
            err.setMessage(`failed to delete twintag`);
            throw err;
        }
    }
    async deleteProjectTwintag() {
        if (!this._data) {
            await this.data();
        }
        const url = this.twintagURL();
        const client = await this.client();
        const [, err] = await client.delete(url);
        if (err) {
            err.setMessage(`failed to delete project twintag`);
            throw err;
        }
    }
    async getUserView(rights) {
        const url = environment.host + '/api/v1/views';
        if (!this._data) {
            await this.data();
        }
        const viewReq = {
            id: undefined,
            type: 'user',
            data: {
                ownerId: this.qid,
                rights: rights,
                isCanocical: 1
            },
            bagStorageQid: this._data?.bagQid
        };
        const client = await this.client();
        const [data, err] = await client.put(url, viewReq);
        if (err) {
            err.setMessage(`failed to get view information`);
            throw err;
        }
        const userView = new View(data.id);
        userView._setConfig({
            project: this.project,
            data: data
        });
        return userView;
    }
    async list(folder) {
        const url = this.fileURL('folders', folder);
        const client = await this.client();
        const [res, err] = await client.get(url);
        if (err) {
            err.setMessage(`failed to get list of files from twintag`);
            throw err;
        }
        return res;
    }
    async addFolder(folderName, folderParent) {
        if (folderName.trim().length == 0) {
            throw new Error("Invalid folder name.");
        }
        const url = this.fileURL('folders');
        let body = {
            name: folderName,
            parent: folderParent ? folderParent : null
        };
        const client = await this.client();
        const [res, err] = await client.put(url, body);
        if (err) {
            err.setMessage(`failed to create folder: ${err.message}`);
            throw err;
        }
        return res;
    }
    async seal() {
        const url = this.fileURL('seal');
        const client = await this.client();
        const [, err] = await client.put(url, {});
        if (err) {
            err.setMessage(`failed to seal`);
            throw err;
        }
    }
    async getMetadata(lang) {
        let url = this.fileURL('data/metadata', undefined, undefined, true);
        url += lang ? `?language=${lang == 'all' ? '*' : lang}` : '';
        const client = await this.client();
        const [res, err] = await client.get(url);
        if (err) {
            err.setMessage(`failed to get metadata of twintag`);
            throw err;
        }
        return Parser.parseSpecialTypes(res);
    }
    async setMetadata(data) {
        const url = this.fileURL('data/metadata');
        const client = await this.client();
        const [res, err] = await client.put(url, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage(`failed to set metadata to twintag`);
            throw err;
        }
        return res;
    }
    async getData(objectAPIName, attribute) {
        let url = this.fileURL('data/' + objectAPIName, undefined, undefined, true);
        if (attribute && attribute != '') {
            url = url + '?property=' + attribute;
        }
        const client = await this.client();
        const [res, err] = await client.get(url);
        if (err) {
            err.setMessage(`failed to get data to twintag object: ${objectAPIName}`);
            throw err;
        }
        return Parser.parseSpecialTypes(res);
    }
    async setData(objectApiName, data) {
        const url = this.fileURL('data/' + objectApiName);
        const client = await this.client();
        const [res, err] = await client.put(url, data, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage(`failed to set data to twintag object: ${objectApiName}`);
            throw err;
        }
        return res;
    }
    async object(objectApiName) {
        const client = await this.client();
        const data = await this.data();
        if (!data.data.project || !data.data.project.projectId || data.data.project.projectId == '') {
            throw new Error(`view not tagged to any project`);
        }
        return new listObject(objectApiName, client, data.id, '', this._useCaching);
    }
    async notify(request, channel) {
        const client = await this.client();
        let body;
        if (typeof request == 'string') {
            body = {
                message: request
            };
        } else {
            body = request;
        }
        channel = channel ? channel : 'email';
        const url = this.viewURL() + '/notification?type=' + channel;
        const [res, err] = await client.post(url, body, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage('failed to notify to all subcribers of twintag');
            throw err;
        }
        return res;
    }
    async sendFeedback(request) {
        const client = await this.client();
        let body;
        if (typeof request == 'string') {
            body = {
                content: request
            };
        } else {
            body = request;
        }
        const url = this.viewURL() + '/feedback';
        const [res, err] = await client.put(url, body, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage(`failed to submit feedback`);
            throw err;
        }
        return res;
    }
    async sendToSubscribers(request) {
        const client = await this.client();
        await this.data();
        const url = this.viewURL() + `/notification?type=customEmail`;
        const [res, err] = await client.post(url, request, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage('failed to notify to all subcribers of twintag through custom email');
            throw err;
        }
        return res;
    }
}
class StructuredObject {
    $schemaScope;
    $qid;
    name = '';
    apiName = '';
    isList = false;
    isGlobal = false;
    keyProperty;
    access;
    _useCaching = false;
    client;
    constructor(apiKey, useCaching = false){
        this.client = new Client(apiKey);
        this._useCaching = useCaching;
    }
    async getAttributes() {
        const url = this.getURL(`/property?object=${this.apiName}&`, this.$schemaScope);
        const [res, err] = await this.client.get(url);
        if (err) {
            err.setMessage(`failed to get attributes: ${err.message}`);
            throw err;
        }
        return res;
    }
    async getAttribute(attributeName) {
        const url = this.getURL(`/property?object=${this.apiName}&property=${attributeName}&`, this.$schemaScope);
        const [res, err] = await this.client.get(url);
        if (err) {
            err.setMessage(`failed to get attribute for ${attributeName}: ${err.message}`);
            throw err;
        }
        return res;
    }
    async newAttribute(attributeName, type, positionBefore) {
        const url = environment.adminHost + '/api/v1/property';
        const reqProperty = {
            $object: this.apiName,
            name: attributeName,
            type: this.getTypeByName(type),
            nextProperty: positionBefore
        };
        const [res, err] = await this.client.put(url, reqProperty);
        if (err) {
            err.setMessage(`failed to create new attribute: ${err.message}`);
            throw err;
        }
        return res;
    }
    async deleteAttribute(attributeName) {
        const url = environment.adminHost + '/api/v1/property';
        const reqProperty = {
            $object: this.apiName,
            name: attributeName
        };
        const [, err] = await this.client.delete(url, reqProperty);
        if (err) {
            err.setMessage(`failed to delete attribute: ${attributeName}: ${err.message}`);
            throw err;
        }
    }
    async updateAttribute(property) {
        const url = environment.adminHost + '/api/v1/property';
        if (!property.$qid) {
            throw new Error(`$qid is not provided in the request object`);
        }
        const reqProperty = {
            $object: this.apiName,
            $qid: property.$qid,
            name: property.name,
            nextProperty: property.nextProperty,
            apiName: property.apiName
        };
        const [res, err] = await this.client.put(url, reqProperty);
        if (err) {
            err.setMessage(`failed to update attribute: ${property.name}: ${err.message}`);
            throw err;
        }
        return res;
    }
    async rename(newName) {
        const url = environment.adminHost + '/api/v1/object';
        const reqobject = {
            $qid: this.$qid,
            name: newName
        };
        const [resp, err] = await this.client.put(url, reqobject);
        if (err) {
            err.setMessage(`failed to rename structured object: ${err.message}`);
            throw err;
        }
        return resp;
    }
    async updateKeyAttribute(attributeName) {
        const url = environment.adminHost + '/api/v1/object';
        const reqobject = {
            $qid: this.$qid,
            keyProperty: attributeName
        };
        const [resp, err] = await this.client.put(url, reqobject);
        if (err) {
            err.setMessage(`failed to update key property of object: ${err.message}`);
            throw err;
        }
        return resp;
    }
    async updateAccess(access) {
        const url = environment.adminHost + '/api/v1/object';
        const reqobject = {
            $qid: this.$qid,
            access: access
        };
        const [resp, err] = await this.client.put(url, reqobject);
        if (err) {
            err.setMessage(`failed to update access of object: ${err.message}`);
            throw err;
        }
        return resp;
    }
    async addTranslationAttribute(langAttributes, parent) {
        const resAttributes = [];
        if (langAttributes == null) {
            return [];
        }
        for (const [language, columnName] of Object.entries(langAttributes)){
            const reqBody = {
                $object: this.apiName,
                $schemaScope: this.$schemaScope,
                name: columnName,
                parent: parent,
                language: language,
                type: this.getTypeByName('string')
            };
            const url = environment.adminHost + '/api/v1/property';
            const [resp, err] = await this.client.put(url, reqBody);
            if (err) {
                err.setMessage(`failed to add translation attribute ${columnName}: ${err.message}`);
            }
            if (resp) {
                resAttributes.push(resp);
            }
        }
        return resAttributes;
    }
    getTypeByName(type) {
        switch(type?.toLowerCase()){
            case 'number':
                return 2;
            case 'datetime':
                return 3;
            case 'richtext':
                return 4;
            case 'file':
                return 5;
            case 'boolean':
                return 6;
            default:
                return 1;
        }
    }
    getURL(url, schemaScope) {
        if (this._useCaching) {
            return environment.cachingHost + url + `schemaScope=${schemaScope}`;
        }
        return environment.adminHost + '/api/v1' + url;
    }
}
var AttributeType;
(function(AttributeType) {
    AttributeType["String"] = 'string';
    AttributeType["Number"] = 'number';
    AttributeType["Datetime"] = 'datetime';
    AttributeType["Richtext"] = 'richtext';
    AttributeType["File"] = 'file';
    AttributeType["Boolean"] = 'boolean';
})(AttributeType || (AttributeType = {}));
class Project {
    apiKey;
    client;
    projectId = '';
    _useCaching = false;
    constructor(apiKey){
        this.apiKey = apiKey;
        this.client = new Client(apiKey);
    }
    useCaching(val) {
        this._useCaching = val;
        this.getProjectId();
    }
    async createBag() {
        return await createBagInternal(this.client, this);
    }
    getView(qid) {
        const view = new View(qid);
        view._setConfig({
            project: this,
            client: this.client
        });
        return view;
    }
    async getMetadata(lang) {
        let langParam = lang ? `language=${lang == 'all' ? '*' : lang}` : '';
        const url = this.getURL('/data/metadata', false, langParam);
        const [res, err] = await this.client.get(url);
        if (err) {
            err.setMessage('failed to get metadata');
            throw err;
        }
        return res;
    }
    async newObject(objectName, objectAPIName = "", isList, isGlobal, keyProperty, access) {
        const url = environment.adminHost + '/api/v1/object';
        const reqobject = {
            name: objectName,
            apiName: objectAPIName,
            isList: isList ? isList : false,
            isGlobal: isGlobal ? isGlobal : false,
            keyProperty: keyProperty ? keyProperty : '',
            access: access
        };
        const [obj, err] = await this.client.put(url, reqobject);
        if (err) {
            err.setMessage('failed to create object');
            throw err;
        }
        const object = new StructuredObject(this.apiKey, this._useCaching);
        object.$qid = obj.$qid;
        object.$schemaScope = obj.$schemaScope;
        object.isGlobal = obj.isGlobal;
        object.isList = obj.isList;
        object.keyProperty = obj.keyProperty;
        object.name = obj.name;
        object.apiName = obj.apiName;
        object.access = obj.access;
        return object;
    }
    async getObject(objectAPIName) {
        const url = this.getURL(`/object?object=${objectAPIName}`, true);
        const [obj, err] = await this.client.get(url);
        if (err) {
            err.setMessage('failed to get object');
            throw err;
        }
        const object = new StructuredObject(this.apiKey, this._useCaching);
        object.$qid = obj.$qid;
        object.$schemaScope = obj.$schemaScope;
        object.isGlobal = obj.isGlobal;
        object.isList = obj.isList;
        object.keyProperty = obj.keyProperty;
        object.name = obj.name;
        object.apiName = obj.apiName;
        return object;
    }
    async deleteObject(objectAPIName) {
        const url = environment.adminHost + '/api/v1/object?object=' + objectAPIName;
        const reqobject = {
            apiName: objectAPIName
        };
        const [, err] = await this.client.delete(url, reqobject);
        if (err) {
            err.setMessage('failed to delete object');
            throw err;
        }
        return;
    }
    async deleteTwintag(viewID) {
        const data = await new View(viewID).data();
        const url = environment.host + '/api/v1/twintags/' + data.bagQid;
        const [, err] = await this.client.delete(url);
        if (err) {
            err.setMessage(`failed to delete project twintag`);
            throw err;
        }
    }
    object(objectAPIName) {
        return new listObject(objectAPIName, this.client, '', this.projectId, this._useCaching);
    }
    getProjectId() {
        this.projectId = '';
        let claim;
        if (typeof atob !== 'undefined') {
            claim = JSON.parse(atob(this.apiKey.split('.')[1]));
        } else if (typeof window !== 'undefined') {
            claim = JSON.parse(window.atob(this.apiKey.split('.')[1]));
        } else if (typeof Buffer !== 'undefined') {
            claim = JSON.parse(Buffer.from(this.apiKey.split('.')[1], 'base64').toString());
        }
        if (claim == null) return;
        this.projectId = claim.ProjectId;
        return this.projectId;
    }
    getURL(url, argumentPreset, langParam = '') {
        let append = argumentPreset ? `&schemaScope=${this.projectId}` : `?schemaScope=${this.projectId}`;
        if (this._useCaching) {
            langParam = langParam ? `&${langParam}` : '';
            return `${environment.cachingHost}/${url}${append}${langParam}`;
        } else {
            langParam = langParam ? `?${langParam}` : '';
            return `${environment.adminHost}/api/v1/${url}${langParam}`;
        }
    }
    async getBags() {
        const url = environment.adminHost + '/api/v1/twintags';
        const [res, err] = await this.client.get(url);
        if (err) {
            err.setMessage('failed to get bag details for the project');
            throw err;
        }
        return res;
    }
    async sendToSubscribers(request) {
        const client = this.client;
        const url = environment.adminHost + '/api/v1/subscribers/send';
        const [res, err] = await client.post(url, request, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (err) {
            err.setMessage('failed to notify to all the subsribers');
            throw err;
        }
        return res;
    }
    async setAllowedLanguages(request, defaultLanguage) {
        const req = {
            allowedLanguages: request
        };
        const url = environment.adminHost + `/api/v1/project/allowedLanguages`;
        const [res, err] = await this.client.put(url, req);
        if (err) {
            err.setMessage(`failed to add languages: ${err.message}`);
            throw err;
        }
        if (defaultLanguage) {
            await this.setDefaultLanguage(defaultLanguage);
        }
        return res;
    }
    async getAllowedLanguages() {
        const url = environment.adminHost + `/api/v1/project/allowedLanguages`;
        const [res, err] = await this.client.get(url);
        if (err) {
            err.setMessage(`failed to get allowed languages: ${err.message}`);
            throw err;
        }
        return res;
    }
    async setDefaultLanguage(request) {
        const req = {
            defaultLanguage: request
        };
        const url = environment.adminHost + `/api/v1/project/defaultLanguage`;
        const [res, err] = await this.client.put(url, req);
        if (err) {
            err.setMessage(`failed to set default language: ${err.message}`);
            throw err;
        }
        return res;
    }
    async getDefaultLanguage() {
        const url = environment.adminHost + `/api/v1/project/defaultLanguage`;
        const [res, err] = await this.client.get(url);
        if (err) {
            err.setMessage(`failed to get default language: ${err.message}`);
            throw err;
        }
        return res;
    }
}
var BagType;
(function(BagType) {
    BagType["Download"] = 'download';
    BagType["Upload"] = 'upload';
    BagType["UploadDownload"] = 'upload-download';
    BagType["Owner"] = 'owner';
})(BagType || (BagType = {}));
class VirtualFile {
    mode;
    constructor(mode){
        this.mode = mode;
    }
}
class Link extends VirtualFile {
    url;
    target;
    constructor(url, target){
        super(50);
        this.url = url;
        this.target = "_blank";
        if (target) {
            this.target = target;
        }
    }
    GetDefinition() {
        const def = {
            specversion: "1.0",
            definition: {
                type: "web-link",
                data: {
                    url: this.url,
                    target: this.target
                }
            }
        };
        return def;
    }
}
const mod = {
    Project: Project,
    BagType: BagType,
    createBag: createBag,
    View: View,
    Link: Link,
    AttributeType: AttributeType,
    FileUploader: FileUploader,
    VERSION: VERSION,
    setHost,
    setAdminHost,
    setCachingHost,
    setLogLevel
};
function copy(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
var Status;
(function(Status) {
    Status[Status["Continue"] = 100] = "Continue";
    Status[Status["SwitchingProtocols"] = 101] = "SwitchingProtocols";
    Status[Status["Processing"] = 102] = "Processing";
    Status[Status["EarlyHints"] = 103] = "EarlyHints";
    Status[Status["OK"] = 200] = "OK";
    Status[Status["Created"] = 201] = "Created";
    Status[Status["Accepted"] = 202] = "Accepted";
    Status[Status["NonAuthoritativeInfo"] = 203] = "NonAuthoritativeInfo";
    Status[Status["NoContent"] = 204] = "NoContent";
    Status[Status["ResetContent"] = 205] = "ResetContent";
    Status[Status["PartialContent"] = 206] = "PartialContent";
    Status[Status["MultiStatus"] = 207] = "MultiStatus";
    Status[Status["AlreadyReported"] = 208] = "AlreadyReported";
    Status[Status["IMUsed"] = 226] = "IMUsed";
    Status[Status["MultipleChoices"] = 300] = "MultipleChoices";
    Status[Status["MovedPermanently"] = 301] = "MovedPermanently";
    Status[Status["Found"] = 302] = "Found";
    Status[Status["SeeOther"] = 303] = "SeeOther";
    Status[Status["NotModified"] = 304] = "NotModified";
    Status[Status["UseProxy"] = 305] = "UseProxy";
    Status[Status["TemporaryRedirect"] = 307] = "TemporaryRedirect";
    Status[Status["PermanentRedirect"] = 308] = "PermanentRedirect";
    Status[Status["BadRequest"] = 400] = "BadRequest";
    Status[Status["Unauthorized"] = 401] = "Unauthorized";
    Status[Status["PaymentRequired"] = 402] = "PaymentRequired";
    Status[Status["Forbidden"] = 403] = "Forbidden";
    Status[Status["NotFound"] = 404] = "NotFound";
    Status[Status["MethodNotAllowed"] = 405] = "MethodNotAllowed";
    Status[Status["NotAcceptable"] = 406] = "NotAcceptable";
    Status[Status["ProxyAuthRequired"] = 407] = "ProxyAuthRequired";
    Status[Status["RequestTimeout"] = 408] = "RequestTimeout";
    Status[Status["Conflict"] = 409] = "Conflict";
    Status[Status["Gone"] = 410] = "Gone";
    Status[Status["LengthRequired"] = 411] = "LengthRequired";
    Status[Status["PreconditionFailed"] = 412] = "PreconditionFailed";
    Status[Status["RequestEntityTooLarge"] = 413] = "RequestEntityTooLarge";
    Status[Status["RequestURITooLong"] = 414] = "RequestURITooLong";
    Status[Status["UnsupportedMediaType"] = 415] = "UnsupportedMediaType";
    Status[Status["RequestedRangeNotSatisfiable"] = 416] = "RequestedRangeNotSatisfiable";
    Status[Status["ExpectationFailed"] = 417] = "ExpectationFailed";
    Status[Status["Teapot"] = 418] = "Teapot";
    Status[Status["MisdirectedRequest"] = 421] = "MisdirectedRequest";
    Status[Status["UnprocessableEntity"] = 422] = "UnprocessableEntity";
    Status[Status["Locked"] = 423] = "Locked";
    Status[Status["FailedDependency"] = 424] = "FailedDependency";
    Status[Status["TooEarly"] = 425] = "TooEarly";
    Status[Status["UpgradeRequired"] = 426] = "UpgradeRequired";
    Status[Status["PreconditionRequired"] = 428] = "PreconditionRequired";
    Status[Status["TooManyRequests"] = 429] = "TooManyRequests";
    Status[Status["RequestHeaderFieldsTooLarge"] = 431] = "RequestHeaderFieldsTooLarge";
    Status[Status["UnavailableForLegalReasons"] = 451] = "UnavailableForLegalReasons";
    Status[Status["InternalServerError"] = 500] = "InternalServerError";
    Status[Status["NotImplemented"] = 501] = "NotImplemented";
    Status[Status["BadGateway"] = 502] = "BadGateway";
    Status[Status["ServiceUnavailable"] = 503] = "ServiceUnavailable";
    Status[Status["GatewayTimeout"] = 504] = "GatewayTimeout";
    Status[Status["HTTPVersionNotSupported"] = 505] = "HTTPVersionNotSupported";
    Status[Status["VariantAlsoNegotiates"] = 506] = "VariantAlsoNegotiates";
    Status[Status["InsufficientStorage"] = 507] = "InsufficientStorage";
    Status[Status["LoopDetected"] = 508] = "LoopDetected";
    Status[Status["NotExtended"] = 510] = "NotExtended";
    Status[Status["NetworkAuthenticationRequired"] = 511] = "NetworkAuthenticationRequired";
})(Status || (Status = {}));
const STATUS_TEXT = new Map([
    [
        Status.Continue,
        "Continue"
    ],
    [
        Status.SwitchingProtocols,
        "Switching Protocols"
    ],
    [
        Status.Processing,
        "Processing"
    ],
    [
        Status.EarlyHints,
        "Early Hints"
    ],
    [
        Status.OK,
        "OK"
    ],
    [
        Status.Created,
        "Created"
    ],
    [
        Status.Accepted,
        "Accepted"
    ],
    [
        Status.NonAuthoritativeInfo,
        "Non-Authoritative Information"
    ],
    [
        Status.NoContent,
        "No Content"
    ],
    [
        Status.ResetContent,
        "Reset Content"
    ],
    [
        Status.PartialContent,
        "Partial Content"
    ],
    [
        Status.MultiStatus,
        "Multi-Status"
    ],
    [
        Status.AlreadyReported,
        "Already Reported"
    ],
    [
        Status.IMUsed,
        "IM Used"
    ],
    [
        Status.MultipleChoices,
        "Multiple Choices"
    ],
    [
        Status.MovedPermanently,
        "Moved Permanently"
    ],
    [
        Status.Found,
        "Found"
    ],
    [
        Status.SeeOther,
        "See Other"
    ],
    [
        Status.NotModified,
        "Not Modified"
    ],
    [
        Status.UseProxy,
        "Use Proxy"
    ],
    [
        Status.TemporaryRedirect,
        "Temporary Redirect"
    ],
    [
        Status.PermanentRedirect,
        "Permanent Redirect"
    ],
    [
        Status.BadRequest,
        "Bad Request"
    ],
    [
        Status.Unauthorized,
        "Unauthorized"
    ],
    [
        Status.PaymentRequired,
        "Payment Required"
    ],
    [
        Status.Forbidden,
        "Forbidden"
    ],
    [
        Status.NotFound,
        "Not Found"
    ],
    [
        Status.MethodNotAllowed,
        "Method Not Allowed"
    ],
    [
        Status.NotAcceptable,
        "Not Acceptable"
    ],
    [
        Status.ProxyAuthRequired,
        "Proxy Authentication Required"
    ],
    [
        Status.RequestTimeout,
        "Request Timeout"
    ],
    [
        Status.Conflict,
        "Conflict"
    ],
    [
        Status.Gone,
        "Gone"
    ],
    [
        Status.LengthRequired,
        "Length Required"
    ],
    [
        Status.PreconditionFailed,
        "Precondition Failed"
    ],
    [
        Status.RequestEntityTooLarge,
        "Request Entity Too Large"
    ],
    [
        Status.RequestURITooLong,
        "Request URI Too Long"
    ],
    [
        Status.UnsupportedMediaType,
        "Unsupported Media Type"
    ],
    [
        Status.RequestedRangeNotSatisfiable,
        "Requested Range Not Satisfiable"
    ],
    [
        Status.ExpectationFailed,
        "Expectation Failed"
    ],
    [
        Status.Teapot,
        "I'm a teapot"
    ],
    [
        Status.MisdirectedRequest,
        "Misdirected Request"
    ],
    [
        Status.UnprocessableEntity,
        "Unprocessable Entity"
    ],
    [
        Status.Locked,
        "Locked"
    ],
    [
        Status.FailedDependency,
        "Failed Dependency"
    ],
    [
        Status.TooEarly,
        "Too Early"
    ],
    [
        Status.UpgradeRequired,
        "Upgrade Required"
    ],
    [
        Status.PreconditionRequired,
        "Precondition Required"
    ],
    [
        Status.TooManyRequests,
        "Too Many Requests"
    ],
    [
        Status.RequestHeaderFieldsTooLarge,
        "Request Header Fields Too Large"
    ],
    [
        Status.UnavailableForLegalReasons,
        "Unavailable For Legal Reasons"
    ],
    [
        Status.InternalServerError,
        "Internal Server Error"
    ],
    [
        Status.NotImplemented,
        "Not Implemented"
    ],
    [
        Status.BadGateway,
        "Bad Gateway"
    ],
    [
        Status.ServiceUnavailable,
        "Service Unavailable"
    ],
    [
        Status.GatewayTimeout,
        "Gateway Timeout"
    ],
    [
        Status.HTTPVersionNotSupported,
        "HTTP Version Not Supported"
    ],
    [
        Status.VariantAlsoNegotiates,
        "Variant Also Negotiates"
    ],
    [
        Status.InsufficientStorage,
        "Insufficient Storage"
    ],
    [
        Status.LoopDetected,
        "Loop Detected"
    ],
    [
        Status.NotExtended,
        "Not Extended"
    ],
    [
        Status.NetworkAuthenticationRequired,
        "Network Authentication Required"
    ], 
]);
class DenoStdInternalError extends Error {
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
const MIN_BUF_SIZE = 16;
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
class BufferFullError extends Error {
    name;
    constructor(partial){
        super("Buffer full");
        this.partial = partial;
        this.name = "BufferFullError";
    }
    partial;
}
class PartialReadError extends Error {
    name = "PartialReadError";
    partial;
    constructor(){
        super("Encountered UnexpectedEof, data only partially read");
    }
}
class BufReader {
    #buf;
    #rd;
    #r = 0;
    #w = 0;
    #eof = false;
    static create(r, size = 4096) {
        return r instanceof BufReader ? r : new BufReader(r, size);
    }
    constructor(rd, size = 4096){
        if (size < 16) {
            size = MIN_BUF_SIZE;
        }
        this.#reset(new Uint8Array(size), rd);
    }
    size() {
        return this.#buf.byteLength;
    }
    buffered() {
        return this.#w - this.#r;
    }
    #fill = async ()=>{
        if (this.#r > 0) {
            this.#buf.copyWithin(0, this.#r, this.#w);
            this.#w -= this.#r;
            this.#r = 0;
        }
        if (this.#w >= this.#buf.byteLength) {
            throw Error("bufio: tried to fill full buffer");
        }
        for(let i = 100; i > 0; i--){
            const rr = await this.#rd.read(this.#buf.subarray(this.#w));
            if (rr === null) {
                this.#eof = true;
                return;
            }
            assert(rr >= 0, "negative read");
            this.#w += rr;
            if (rr > 0) {
                return;
            }
        }
        throw new Error(`No progress after ${100} read() calls`);
    };
    reset(r) {
        this.#reset(this.#buf, r);
    }
    #reset = (buf, rd)=>{
        this.#buf = buf;
        this.#rd = rd;
        this.#eof = false;
    };
    async read(p) {
        let rr = p.byteLength;
        if (p.byteLength === 0) return rr;
        if (this.#r === this.#w) {
            if (p.byteLength >= this.#buf.byteLength) {
                const rr1 = await this.#rd.read(p);
                const nread = rr1 ?? 0;
                assert(nread >= 0, "negative read");
                return rr1;
            }
            this.#r = 0;
            this.#w = 0;
            rr = await this.#rd.read(this.#buf);
            if (rr === 0 || rr === null) return rr;
            assert(rr >= 0, "negative read");
            this.#w += rr;
        }
        const copied = copy(this.#buf.subarray(this.#r, this.#w), p, 0);
        this.#r += copied;
        return copied;
    }
    async readFull(p) {
        let bytesRead = 0;
        while(bytesRead < p.length){
            try {
                const rr = await this.read(p.subarray(bytesRead));
                if (rr === null) {
                    if (bytesRead === 0) {
                        return null;
                    } else {
                        throw new PartialReadError();
                    }
                }
                bytesRead += rr;
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = p.subarray(0, bytesRead);
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = p.subarray(0, bytesRead);
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
        }
        return p;
    }
    async readByte() {
        while(this.#r === this.#w){
            if (this.#eof) return null;
            await this.#fill();
        }
        const c = this.#buf[this.#r];
        this.#r++;
        return c;
    }
    async readString(delim) {
        if (delim.length !== 1) {
            throw new Error("Delimiter should be a single character");
        }
        const buffer = await this.readSlice(delim.charCodeAt(0));
        if (buffer === null) return null;
        return new TextDecoder().decode(buffer);
    }
    async readLine() {
        let line = null;
        try {
            line = await this.readSlice(LF);
        } catch (err) {
            if (err instanceof Deno.errors.BadResource) {
                throw err;
            }
            let partial;
            if (err instanceof PartialReadError) {
                partial = err.partial;
                assert(partial instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
            }
            if (!(err instanceof BufferFullError)) {
                throw err;
            }
            partial = err.partial;
            if (!this.#eof && partial && partial.byteLength > 0 && partial[partial.byteLength - 1] === CR) {
                assert(this.#r > 0, "bufio: tried to rewind past start of buffer");
                this.#r--;
                partial = partial.subarray(0, partial.byteLength - 1);
            }
            if (partial) {
                return {
                    line: partial,
                    more: !this.#eof
                };
            }
        }
        if (line === null) {
            return null;
        }
        if (line.byteLength === 0) {
            return {
                line,
                more: false
            };
        }
        if (line[line.byteLength - 1] == LF) {
            let drop = 1;
            if (line.byteLength > 1 && line[line.byteLength - 2] === CR) {
                drop = 2;
            }
            line = line.subarray(0, line.byteLength - drop);
        }
        return {
            line,
            more: false
        };
    }
    async readSlice(delim) {
        let s = 0;
        let slice;
        while(true){
            let i = this.#buf.subarray(this.#r + s, this.#w).indexOf(delim);
            if (i >= 0) {
                i += s;
                slice = this.#buf.subarray(this.#r, this.#r + i + 1);
                this.#r += i + 1;
                break;
            }
            if (this.#eof) {
                if (this.#r === this.#w) {
                    return null;
                }
                slice = this.#buf.subarray(this.#r, this.#w);
                this.#r = this.#w;
                break;
            }
            if (this.buffered() >= this.#buf.byteLength) {
                this.#r = this.#w;
                const oldbuf = this.#buf;
                const newbuf = this.#buf.slice(0);
                this.#buf = newbuf;
                throw new BufferFullError(oldbuf);
            }
            s = this.#w - this.#r;
            try {
                await this.#fill();
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = slice;
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = slice;
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
        }
        return slice;
    }
    async peek(n) {
        if (n < 0) {
            throw Error("negative count");
        }
        let avail = this.#w - this.#r;
        while(avail < n && avail < this.#buf.byteLength && !this.#eof){
            try {
                await this.#fill();
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = this.#buf.subarray(this.#r, this.#w);
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = this.#buf.subarray(this.#r, this.#w);
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
            avail = this.#w - this.#r;
        }
        if (avail === 0 && this.#eof) {
            return null;
        } else if (avail < n && this.#eof) {
            return this.#buf.subarray(this.#r, this.#r + avail);
        } else if (avail < n) {
            throw new BufferFullError(this.#buf.subarray(this.#r, this.#w));
        }
        return this.#buf.subarray(this.#r, this.#r + n);
    }
}
class AbstractBufBase {
    buf;
    usedBufferBytes = 0;
    err = null;
    constructor(buf){
        this.buf = buf;
    }
    size() {
        return this.buf.byteLength;
    }
    available() {
        return this.buf.byteLength - this.usedBufferBytes;
    }
    buffered() {
        return this.usedBufferBytes;
    }
}
class BufWriter extends AbstractBufBase {
    #writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriter ? writer : new BufWriter(writer, size);
    }
    constructor(writer, size = 4096){
        super(new Uint8Array(size <= 0 ? 4096 : size));
        this.#writer = writer;
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.#writer = w;
    }
    async flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            const p = this.buf.subarray(0, this.usedBufferBytes);
            let nwritten = 0;
            while(nwritten < p.length){
                nwritten += await this.#writer.write(p.subarray(nwritten));
            }
        } catch (e) {
            if (e instanceof Error) {
                this.err = e;
            }
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    async write(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = await this.#writer.write(data);
                } catch (e) {
                    if (e instanceof Error) {
                        this.err = e;
                    }
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                await this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
class BufWriterSync extends AbstractBufBase {
    #writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriterSync ? writer : new BufWriterSync(writer, size);
    }
    constructor(writer, size = 4096){
        super(new Uint8Array(size <= 0 ? 4096 : size));
        this.#writer = writer;
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.#writer = w;
    }
    flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            const p = this.buf.subarray(0, this.usedBufferBytes);
            let nwritten = 0;
            while(nwritten < p.length){
                nwritten += this.#writer.writeSync(p.subarray(nwritten));
            }
        } catch (e) {
            if (e instanceof Error) {
                this.err = e;
            }
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    writeSync(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = this.#writer.writeSync(data);
                } catch (e) {
                    if (e instanceof Error) {
                        this.err = e;
                    }
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
const osType = (()=>{
    const { Deno: Deno1  } = globalThis;
    if (typeof Deno1?.build?.os === "string") {
        return Deno1.build.os;
    }
    const { navigator  } = globalThis;
    if (navigator?.appVersion?.includes?.("Win")) {
        return "windows";
    }
    return "linux";
})();
const isWindows = osType === "windows";
const CHAR_FORWARD_SLASH = 47;
function assertPath(path) {
    if (typeof path !== "string") {
        throw new TypeError(`Path must be a string. Received ${JSON.stringify(path)}`);
    }
}
function isPosixPathSeparator(code) {
    return code === 47;
}
function isPathSeparator(code) {
    return isPosixPathSeparator(code) || code === 92;
}
function isWindowsDeviceRoot(code) {
    return code >= 97 && code <= 122 || code >= 65 && code <= 90;
}
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
    let res = "";
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code;
    for(let i = 0, len = path.length; i <= len; ++i){
        if (i < len) code = path.charCodeAt(i);
        else if (isPathSeparator(code)) break;
        else code = CHAR_FORWARD_SLASH;
        if (isPathSeparator(code)) {
            if (lastSlash === i - 1 || dots === 1) {} else if (lastSlash !== i - 1 && dots === 2) {
                if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
                    if (res.length > 2) {
                        const lastSlashIndex = res.lastIndexOf(separator);
                        if (lastSlashIndex === -1) {
                            res = "";
                            lastSegmentLength = 0;
                        } else {
                            res = res.slice(0, lastSlashIndex);
                            lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
                        }
                        lastSlash = i;
                        dots = 0;
                        continue;
                    } else if (res.length === 2 || res.length === 1) {
                        res = "";
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                }
                if (allowAboveRoot) {
                    if (res.length > 0) res += `${separator}..`;
                    else res = "..";
                    lastSegmentLength = 2;
                }
            } else {
                if (res.length > 0) res += separator + path.slice(lastSlash + 1, i);
                else res = path.slice(lastSlash + 1, i);
                lastSegmentLength = i - lastSlash - 1;
            }
            lastSlash = i;
            dots = 0;
        } else if (code === 46 && dots !== -1) {
            ++dots;
        } else {
            dots = -1;
        }
    }
    return res;
}
function _format(sep, pathObject) {
    const dir = pathObject.dir || pathObject.root;
    const base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
    if (!dir) return base;
    if (dir === pathObject.root) return dir + base;
    return dir + sep + base;
}
const WHITESPACE_ENCODINGS = {
    "\u0009": "%09",
    "\u000A": "%0A",
    "\u000B": "%0B",
    "\u000C": "%0C",
    "\u000D": "%0D",
    "\u0020": "%20"
};
function encodeWhitespace(string) {
    return string.replaceAll(/[\s]/g, (c)=>{
        return WHITESPACE_ENCODINGS[c] ?? c;
    });
}
const sep = "\\";
const delimiter = ";";
function resolve(...pathSegments) {
    let resolvedDevice = "";
    let resolvedTail = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1; i--){
        let path;
        const { Deno: Deno1  } = globalThis;
        if (i >= 0) {
            path = pathSegments[i];
        } else if (!resolvedDevice) {
            if (typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a drive-letter-less path without a CWD.");
            }
            path = Deno1.cwd();
        } else {
            if (typeof Deno1?.env?.get !== "function" || typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno1.cwd();
            if (path === undefined || path.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
                path = `${resolvedDevice}\\`;
            }
        }
        assertPath(path);
        const len = path.length;
        if (len === 0) continue;
        let rootEnd = 0;
        let device = "";
        let isAbsolute = false;
        const code = path.charCodeAt(0);
        if (len > 1) {
            if (isPathSeparator(code)) {
                isAbsolute = true;
                if (isPathSeparator(path.charCodeAt(1))) {
                    let j = 2;
                    let last = j;
                    for(; j < len; ++j){
                        if (isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        const firstPart = path.slice(last, j);
                        last = j;
                        for(; j < len; ++j){
                            if (!isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j < len && j !== last) {
                            last = j;
                            for(; j < len; ++j){
                                if (isPathSeparator(path.charCodeAt(j))) break;
                            }
                            if (j === len) {
                                device = `\\\\${firstPart}\\${path.slice(last)}`;
                                rootEnd = j;
                            } else if (j !== last) {
                                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                                rootEnd = j;
                            }
                        }
                    }
                } else {
                    rootEnd = 1;
                }
            } else if (isWindowsDeviceRoot(code)) {
                if (path.charCodeAt(1) === 58) {
                    device = path.slice(0, 2);
                    rootEnd = 2;
                    if (len > 2) {
                        if (isPathSeparator(path.charCodeAt(2))) {
                            isAbsolute = true;
                            rootEnd = 3;
                        }
                    }
                }
            }
        } else if (isPathSeparator(code)) {
            rootEnd = 1;
            isAbsolute = true;
        }
        if (device.length > 0 && resolvedDevice.length > 0 && device.toLowerCase() !== resolvedDevice.toLowerCase()) {
            continue;
        }
        if (resolvedDevice.length === 0 && device.length > 0) {
            resolvedDevice = device;
        }
        if (!resolvedAbsolute) {
            resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
            resolvedAbsolute = isAbsolute;
        }
        if (resolvedAbsolute && resolvedDevice.length > 0) break;
    }
    resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, "\\", isPathSeparator);
    return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}
function normalize(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return ".";
    let rootEnd = 0;
    let device;
    let isAbsolute = false;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            isAbsolute = true;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    const firstPart = path.slice(last, j);
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            return `\\\\${firstPart}\\${path.slice(last)}\\`;
                        } else if (j !== last) {
                            device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                            rootEnd = j;
                        }
                    }
                }
            } else {
                rootEnd = 1;
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                device = path.slice(0, 2);
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        isAbsolute = true;
                        rootEnd = 3;
                    }
                }
            }
        }
    } else if (isPathSeparator(code)) {
        return "\\";
    }
    let tail;
    if (rootEnd < len) {
        tail = normalizeString(path.slice(rootEnd), !isAbsolute, "\\", isPathSeparator);
    } else {
        tail = "";
    }
    if (tail.length === 0 && !isAbsolute) tail = ".";
    if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
        tail += "\\";
    }
    if (device === undefined) {
        if (isAbsolute) {
            if (tail.length > 0) return `\\${tail}`;
            else return "\\";
        } else if (tail.length > 0) {
            return tail;
        } else {
            return "";
        }
    } else if (isAbsolute) {
        if (tail.length > 0) return `${device}\\${tail}`;
        else return `${device}\\`;
    } else if (tail.length > 0) {
        return device + tail;
    } else {
        return device;
    }
}
function isAbsolute(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return false;
    const code = path.charCodeAt(0);
    if (isPathSeparator(code)) {
        return true;
    } else if (isWindowsDeviceRoot(code)) {
        if (len > 2 && path.charCodeAt(1) === 58) {
            if (isPathSeparator(path.charCodeAt(2))) return true;
        }
    }
    return false;
}
function join(...paths) {
    const pathsCount = paths.length;
    if (pathsCount === 0) return ".";
    let joined;
    let firstPart = null;
    for(let i = 0; i < pathsCount; ++i){
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (joined === undefined) joined = firstPart = path;
            else joined += `\\${path}`;
        }
    }
    if (joined === undefined) return ".";
    let needsReplace = true;
    let slashCount = 0;
    assert(firstPart != null);
    if (isPathSeparator(firstPart.charCodeAt(0))) {
        ++slashCount;
        const firstLen = firstPart.length;
        if (firstLen > 1) {
            if (isPathSeparator(firstPart.charCodeAt(1))) {
                ++slashCount;
                if (firstLen > 2) {
                    if (isPathSeparator(firstPart.charCodeAt(2))) ++slashCount;
                    else {
                        needsReplace = false;
                    }
                }
            }
        }
    }
    if (needsReplace) {
        for(; slashCount < joined.length; ++slashCount){
            if (!isPathSeparator(joined.charCodeAt(slashCount))) break;
        }
        if (slashCount >= 2) joined = `\\${joined.slice(slashCount)}`;
    }
    return normalize(joined);
}
function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    const fromOrig = resolve(from);
    const toOrig = resolve(to);
    if (fromOrig === toOrig) return "";
    from = fromOrig.toLowerCase();
    to = toOrig.toLowerCase();
    if (from === to) return "";
    let fromStart = 0;
    let fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== 92) break;
    }
    for(; fromEnd - 1 > fromStart; --fromEnd){
        if (from.charCodeAt(fromEnd - 1) !== 92) break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 0;
    let toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== 92) break;
    }
    for(; toEnd - 1 > toStart; --toEnd){
        if (to.charCodeAt(toEnd - 1) !== 92) break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 92) {
                    return toOrig.slice(toStart + i + 1);
                } else if (i === 2) {
                    return toOrig.slice(toStart + i);
                }
            }
            if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 92) {
                    lastCommonSep = i;
                } else if (i === 2) {
                    lastCommonSep = 3;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === 92) lastCommonSep = i;
    }
    if (i !== length && lastCommonSep === -1) {
        return toOrig;
    }
    let out = "";
    if (lastCommonSep === -1) lastCommonSep = 0;
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === 92) {
            if (out.length === 0) out += "..";
            else out += "\\..";
        }
    }
    if (out.length > 0) {
        return out + toOrig.slice(toStart + lastCommonSep, toEnd);
    } else {
        toStart += lastCommonSep;
        if (toOrig.charCodeAt(toStart) === 92) ++toStart;
        return toOrig.slice(toStart, toEnd);
    }
}
function toNamespacedPath(path) {
    if (typeof path !== "string") return path;
    if (path.length === 0) return "";
    const resolvedPath = resolve(path);
    if (resolvedPath.length >= 3) {
        if (resolvedPath.charCodeAt(0) === 92) {
            if (resolvedPath.charCodeAt(1) === 92) {
                const code = resolvedPath.charCodeAt(2);
                if (code !== 63 && code !== 46) {
                    return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
                }
            }
        } else if (isWindowsDeviceRoot(resolvedPath.charCodeAt(0))) {
            if (resolvedPath.charCodeAt(1) === 58 && resolvedPath.charCodeAt(2) === 92) {
                return `\\\\?\\${resolvedPath}`;
            }
        }
    }
    return path;
}
function dirname(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return ".";
    let rootEnd = -1;
    let end = -1;
    let matchedSlash = true;
    let offset = 0;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = offset = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            return path;
                        }
                        if (j !== last) {
                            rootEnd = offset = j + 1;
                        }
                    }
                }
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                rootEnd = offset = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) rootEnd = offset = 3;
                }
            }
        }
    } else if (isPathSeparator(code)) {
        return path;
    }
    for(let i = len - 1; i >= offset; --i){
        if (isPathSeparator(path.charCodeAt(i))) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) {
        if (rootEnd === -1) return ".";
        else end = rootEnd;
    }
    return path.slice(0, end);
}
function basename(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (path.length >= 2) {
        const drive = path.charCodeAt(0);
        if (isWindowsDeviceRoot(drive)) {
            if (path.charCodeAt(1) === 58) start = 2;
        }
    }
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path) return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for(i = path.length - 1; i >= start; --i){
            const code = path.charCodeAt(i);
            if (isPathSeparator(code)) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    } else {
                        extIdx = -1;
                        end = firstNonSlashEnd;
                    }
                }
            }
        }
        if (start === end) end = firstNonSlashEnd;
        else if (end === -1) end = path.length;
        return path.slice(start, end);
    } else {
        for(i = path.length - 1; i >= start; --i){
            if (isPathSeparator(path.charCodeAt(i))) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
function extname(path) {
    assertPath(path);
    let start = 0;
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    if (path.length >= 2 && path.charCodeAt(1) === 58 && isWindowsDeviceRoot(path.charCodeAt(0))) {
        start = startPart = 2;
    }
    for(let i = path.length - 1; i >= start; --i){
        const code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
function format(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format("\\", pathObject);
}
function parse(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    const len = path.length;
    if (len === 0) return ret;
    let rootEnd = 0;
    let code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            rootEnd = j;
                        } else if (j !== last) {
                            rootEnd = j + 1;
                        }
                    }
                }
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        if (len === 3) {
                            ret.root = ret.dir = path;
                            return ret;
                        }
                        rootEnd = 3;
                    }
                } else {
                    ret.root = ret.dir = path;
                    return ret;
                }
            }
        }
    } else if (isPathSeparator(code)) {
        ret.root = ret.dir = path;
        return ret;
    }
    if (rootEnd > 0) ret.root = path.slice(0, rootEnd);
    let startDot = -1;
    let startPart = rootEnd;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for(; i >= rootEnd; --i){
        code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        if (end !== -1) {
            ret.base = ret.name = path.slice(startPart, end);
        }
    } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0 && startPart !== rootEnd) {
        ret.dir = path.slice(0, startPart - 1);
    } else ret.dir = ret.root;
    return ret;
}
function fromFileUrl(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
    if (url.hostname != "") {
        path = `\\\\${url.hostname}${path}`;
    }
    return path;
}
function toFileUrl(path) {
    if (!isAbsolute(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const [, hostname, pathname] = path.match(/^(?:[/\\]{2}([^/\\]+)(?=[/\\](?:[^/\\]|$)))?(.*)/);
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(pathname.replace(/%/g, "%25"));
    if (hostname != null && hostname != "localhost") {
        url.hostname = hostname;
        if (!url.hostname) {
            throw new TypeError("Invalid hostname.");
        }
    }
    return url;
}
const mod1 = {
    sep: sep,
    delimiter: delimiter,
    resolve: resolve,
    normalize: normalize,
    isAbsolute: isAbsolute,
    join: join,
    relative: relative,
    toNamespacedPath: toNamespacedPath,
    dirname: dirname,
    basename: basename,
    extname: extname,
    format: format,
    parse: parse,
    fromFileUrl: fromFileUrl,
    toFileUrl: toFileUrl
};
const sep1 = "/";
const delimiter1 = ":";
function resolve1(...pathSegments) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--){
        let path;
        if (i >= 0) path = pathSegments[i];
        else {
            const { Deno: Deno1  } = globalThis;
            if (typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno1.cwd();
        }
        assertPath(path);
        if (path.length === 0) {
            continue;
        }
        resolvedPath = `${path}/${resolvedPath}`;
        resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    }
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator);
    if (resolvedAbsolute) {
        if (resolvedPath.length > 0) return `/${resolvedPath}`;
        else return "/";
    } else if (resolvedPath.length > 0) return resolvedPath;
    else return ".";
}
function normalize1(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const isAbsolute = path.charCodeAt(0) === 47;
    const trailingSeparator = path.charCodeAt(path.length - 1) === 47;
    path = normalizeString(path, !isAbsolute, "/", isPosixPathSeparator);
    if (path.length === 0 && !isAbsolute) path = ".";
    if (path.length > 0 && trailingSeparator) path += "/";
    if (isAbsolute) return `/${path}`;
    return path;
}
function isAbsolute1(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47;
}
function join1(...paths) {
    if (paths.length === 0) return ".";
    let joined;
    for(let i = 0, len = paths.length; i < len; ++i){
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (!joined) joined = path;
            else joined += `/${path}`;
        }
    }
    if (!joined) return ".";
    return normalize1(joined);
}
function relative1(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    from = resolve1(from);
    to = resolve1(to);
    if (from === to) return "";
    let fromStart = 1;
    const fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== 47) break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 1;
    const toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== 47) break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 47) {
                    return to.slice(toStart + i + 1);
                } else if (i === 0) {
                    return to.slice(toStart + i);
                }
            } else if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 47) {
                    lastCommonSep = i;
                } else if (i === 0) {
                    lastCommonSep = 0;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === 47) lastCommonSep = i;
    }
    let out = "";
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === 47) {
            if (out.length === 0) out += "..";
            else out += "/..";
        }
    }
    if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
    else {
        toStart += lastCommonSep;
        if (to.charCodeAt(toStart) === 47) ++toStart;
        return to.slice(toStart);
    }
}
function toNamespacedPath1(path) {
    return path;
}
function dirname1(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const hasRoot = path.charCodeAt(0) === 47;
    let end = -1;
    let matchedSlash = true;
    for(let i = path.length - 1; i >= 1; --i){
        if (path.charCodeAt(i) === 47) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) return hasRoot ? "/" : ".";
    if (hasRoot && end === 1) return "//";
    return path.slice(0, end);
}
function basename1(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path) return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for(i = path.length - 1; i >= 0; --i){
            const code = path.charCodeAt(i);
            if (code === 47) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    } else {
                        extIdx = -1;
                        end = firstNonSlashEnd;
                    }
                }
            }
        }
        if (start === end) end = firstNonSlashEnd;
        else if (end === -1) end = path.length;
        return path.slice(start, end);
    } else {
        for(i = path.length - 1; i >= 0; --i){
            if (path.charCodeAt(i) === 47) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
function extname1(path) {
    assertPath(path);
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    for(let i = path.length - 1; i >= 0; --i){
        const code = path.charCodeAt(i);
        if (code === 47) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
function format1(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format("/", pathObject);
}
function parse1(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    if (path.length === 0) return ret;
    const isAbsolute = path.charCodeAt(0) === 47;
    let start;
    if (isAbsolute) {
        ret.root = "/";
        start = 1;
    } else {
        start = 0;
    }
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for(; i >= start; --i){
        const code = path.charCodeAt(i);
        if (code === 47) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        if (end !== -1) {
            if (startPart === 0 && isAbsolute) {
                ret.base = ret.name = path.slice(1, end);
            } else {
                ret.base = ret.name = path.slice(startPart, end);
            }
        }
    } else {
        if (startPart === 0 && isAbsolute) {
            ret.name = path.slice(1, startDot);
            ret.base = path.slice(1, end);
        } else {
            ret.name = path.slice(startPart, startDot);
            ret.base = path.slice(startPart, end);
        }
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0) ret.dir = path.slice(0, startPart - 1);
    else if (isAbsolute) ret.dir = "/";
    return ret;
}
function fromFileUrl1(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
function toFileUrl1(path) {
    if (!isAbsolute1(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(path.replace(/%/g, "%25").replace(/\\/g, "%5C"));
    return url;
}
const mod2 = {
    sep: sep1,
    delimiter: delimiter1,
    resolve: resolve1,
    normalize: normalize1,
    isAbsolute: isAbsolute1,
    join: join1,
    relative: relative1,
    toNamespacedPath: toNamespacedPath1,
    dirname: dirname1,
    basename: basename1,
    extname: extname1,
    format: format1,
    parse: parse1,
    fromFileUrl: fromFileUrl1,
    toFileUrl: toFileUrl1
};
const path = isWindows ? mod1 : mod2;
const { join: join2 , normalize: normalize2  } = path;
const path1 = isWindows ? mod1 : mod2;
const { basename: basename2 , delimiter: delimiter2 , dirname: dirname2 , extname: extname2 , format: format2 , fromFileUrl: fromFileUrl2 , isAbsolute: isAbsolute2 , join: join3 , normalize: normalize3 , parse: parse2 , relative: relative2 , resolve: resolve2 , sep: sep2 , toFileUrl: toFileUrl2 , toNamespacedPath: toNamespacedPath2 ,  } = path1;
const __default = JSON.parse(`{
  "application/1d-interleaved-parityfec": {
    "source": "iana"
  },
  "application/3gpdash-qoe-report+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/3gpp-ims+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/3gpphal+json": {
    "source": "iana",
    "compressible": true
  },
  "application/3gpphalforms+json": {
    "source": "iana",
    "compressible": true
  },
  "application/a2l": {
    "source": "iana"
  },
  "application/ace+cbor": {
    "source": "iana"
  },
  "application/activemessage": {
    "source": "iana"
  },
  "application/activity+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-costmap+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-costmapfilter+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-directory+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-endpointcost+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-endpointcostparams+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-endpointprop+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-endpointpropparams+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-error+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-networkmap+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-networkmapfilter+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-updatestreamcontrol+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-updatestreamparams+json": {
    "source": "iana",
    "compressible": true
  },
  "application/aml": {
    "source": "iana"
  },
  "application/andrew-inset": {
    "source": "iana",
    "extensions": ["ez"]
  },
  "application/applefile": {
    "source": "iana"
  },
  "application/applixware": {
    "source": "apache",
    "extensions": ["aw"]
  },
  "application/at+jwt": {
    "source": "iana"
  },
  "application/atf": {
    "source": "iana"
  },
  "application/atfx": {
    "source": "iana"
  },
  "application/atom+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["atom"]
  },
  "application/atomcat+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["atomcat"]
  },
  "application/atomdeleted+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["atomdeleted"]
  },
  "application/atomicmail": {
    "source": "iana"
  },
  "application/atomsvc+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["atomsvc"]
  },
  "application/atsc-dwd+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["dwd"]
  },
  "application/atsc-dynamic-event-message": {
    "source": "iana"
  },
  "application/atsc-held+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["held"]
  },
  "application/atsc-rdt+json": {
    "source": "iana",
    "compressible": true
  },
  "application/atsc-rsat+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rsat"]
  },
  "application/atxml": {
    "source": "iana"
  },
  "application/auth-policy+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/bacnet-xdd+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/batch-smtp": {
    "source": "iana"
  },
  "application/bdoc": {
    "compressible": false,
    "extensions": ["bdoc"]
  },
  "application/beep+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/calendar+json": {
    "source": "iana",
    "compressible": true
  },
  "application/calendar+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xcs"]
  },
  "application/call-completion": {
    "source": "iana"
  },
  "application/cals-1840": {
    "source": "iana"
  },
  "application/captive+json": {
    "source": "iana",
    "compressible": true
  },
  "application/cbor": {
    "source": "iana"
  },
  "application/cbor-seq": {
    "source": "iana"
  },
  "application/cccex": {
    "source": "iana"
  },
  "application/ccmp+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/ccxml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ccxml"]
  },
  "application/cdfx+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["cdfx"]
  },
  "application/cdmi-capability": {
    "source": "iana",
    "extensions": ["cdmia"]
  },
  "application/cdmi-container": {
    "source": "iana",
    "extensions": ["cdmic"]
  },
  "application/cdmi-domain": {
    "source": "iana",
    "extensions": ["cdmid"]
  },
  "application/cdmi-object": {
    "source": "iana",
    "extensions": ["cdmio"]
  },
  "application/cdmi-queue": {
    "source": "iana",
    "extensions": ["cdmiq"]
  },
  "application/cdni": {
    "source": "iana"
  },
  "application/cea": {
    "source": "iana"
  },
  "application/cea-2018+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/cellml+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/cfw": {
    "source": "iana"
  },
  "application/city+json": {
    "source": "iana",
    "compressible": true
  },
  "application/clr": {
    "source": "iana"
  },
  "application/clue+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/clue_info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/cms": {
    "source": "iana"
  },
  "application/cnrp+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/coap-group+json": {
    "source": "iana",
    "compressible": true
  },
  "application/coap-payload": {
    "source": "iana"
  },
  "application/commonground": {
    "source": "iana"
  },
  "application/conference-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/cose": {
    "source": "iana"
  },
  "application/cose-key": {
    "source": "iana"
  },
  "application/cose-key-set": {
    "source": "iana"
  },
  "application/cpl+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["cpl"]
  },
  "application/csrattrs": {
    "source": "iana"
  },
  "application/csta+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/cstadata+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/csvm+json": {
    "source": "iana",
    "compressible": true
  },
  "application/cu-seeme": {
    "source": "apache",
    "extensions": ["cu"]
  },
  "application/cwt": {
    "source": "iana"
  },
  "application/cybercash": {
    "source": "iana"
  },
  "application/dart": {
    "compressible": true
  },
  "application/dash+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mpd"]
  },
  "application/dash-patch+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mpp"]
  },
  "application/dashdelta": {
    "source": "iana"
  },
  "application/davmount+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["davmount"]
  },
  "application/dca-rft": {
    "source": "iana"
  },
  "application/dcd": {
    "source": "iana"
  },
  "application/dec-dx": {
    "source": "iana"
  },
  "application/dialog-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/dicom": {
    "source": "iana"
  },
  "application/dicom+json": {
    "source": "iana",
    "compressible": true
  },
  "application/dicom+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/dii": {
    "source": "iana"
  },
  "application/dit": {
    "source": "iana"
  },
  "application/dns": {
    "source": "iana"
  },
  "application/dns+json": {
    "source": "iana",
    "compressible": true
  },
  "application/dns-message": {
    "source": "iana"
  },
  "application/docbook+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["dbk"]
  },
  "application/dots+cbor": {
    "source": "iana"
  },
  "application/dskpp+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/dssc+der": {
    "source": "iana",
    "extensions": ["dssc"]
  },
  "application/dssc+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xdssc"]
  },
  "application/dvcs": {
    "source": "iana"
  },
  "application/ecmascript": {
    "source": "iana",
    "compressible": true,
    "extensions": ["es","ecma"]
  },
  "application/edi-consent": {
    "source": "iana"
  },
  "application/edi-x12": {
    "source": "iana",
    "compressible": false
  },
  "application/edifact": {
    "source": "iana",
    "compressible": false
  },
  "application/efi": {
    "source": "iana"
  },
  "application/elm+json": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/elm+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/emergencycalldata.cap+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/emergencycalldata.comment+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/emergencycalldata.control+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/emergencycalldata.deviceinfo+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/emergencycalldata.ecall.msd": {
    "source": "iana"
  },
  "application/emergencycalldata.providerinfo+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/emergencycalldata.serviceinfo+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/emergencycalldata.subscriberinfo+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/emergencycalldata.veds+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/emma+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["emma"]
  },
  "application/emotionml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["emotionml"]
  },
  "application/encaprtp": {
    "source": "iana"
  },
  "application/epp+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/epub+zip": {
    "source": "iana",
    "compressible": false,
    "extensions": ["epub"]
  },
  "application/eshop": {
    "source": "iana"
  },
  "application/exi": {
    "source": "iana",
    "extensions": ["exi"]
  },
  "application/expect-ct-report+json": {
    "source": "iana",
    "compressible": true
  },
  "application/express": {
    "source": "iana",
    "extensions": ["exp"]
  },
  "application/fastinfoset": {
    "source": "iana"
  },
  "application/fastsoap": {
    "source": "iana"
  },
  "application/fdt+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["fdt"]
  },
  "application/fhir+json": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/fhir+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/fido.trusted-apps+json": {
    "compressible": true
  },
  "application/fits": {
    "source": "iana"
  },
  "application/flexfec": {
    "source": "iana"
  },
  "application/font-sfnt": {
    "source": "iana"
  },
  "application/font-tdpfr": {
    "source": "iana",
    "extensions": ["pfr"]
  },
  "application/font-woff": {
    "source": "iana",
    "compressible": false
  },
  "application/framework-attributes+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/geo+json": {
    "source": "iana",
    "compressible": true,
    "extensions": ["geojson"]
  },
  "application/geo+json-seq": {
    "source": "iana"
  },
  "application/geopackage+sqlite3": {
    "source": "iana"
  },
  "application/geoxacml+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/gltf-buffer": {
    "source": "iana"
  },
  "application/gml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["gml"]
  },
  "application/gpx+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["gpx"]
  },
  "application/gxf": {
    "source": "apache",
    "extensions": ["gxf"]
  },
  "application/gzip": {
    "source": "iana",
    "compressible": false,
    "extensions": ["gz"]
  },
  "application/h224": {
    "source": "iana"
  },
  "application/held+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/hjson": {
    "extensions": ["hjson"]
  },
  "application/http": {
    "source": "iana"
  },
  "application/hyperstudio": {
    "source": "iana",
    "extensions": ["stk"]
  },
  "application/ibe-key-request+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/ibe-pkg-reply+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/ibe-pp-data": {
    "source": "iana"
  },
  "application/iges": {
    "source": "iana"
  },
  "application/im-iscomposing+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/index": {
    "source": "iana"
  },
  "application/index.cmd": {
    "source": "iana"
  },
  "application/index.obj": {
    "source": "iana"
  },
  "application/index.response": {
    "source": "iana"
  },
  "application/index.vnd": {
    "source": "iana"
  },
  "application/inkml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ink","inkml"]
  },
  "application/iotp": {
    "source": "iana"
  },
  "application/ipfix": {
    "source": "iana",
    "extensions": ["ipfix"]
  },
  "application/ipp": {
    "source": "iana"
  },
  "application/isup": {
    "source": "iana"
  },
  "application/its+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["its"]
  },
  "application/java-archive": {
    "source": "apache",
    "compressible": false,
    "extensions": ["jar","war","ear"]
  },
  "application/java-serialized-object": {
    "source": "apache",
    "compressible": false,
    "extensions": ["ser"]
  },
  "application/java-vm": {
    "source": "apache",
    "compressible": false,
    "extensions": ["class"]
  },
  "application/javascript": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["js","mjs"]
  },
  "application/jf2feed+json": {
    "source": "iana",
    "compressible": true
  },
  "application/jose": {
    "source": "iana"
  },
  "application/jose+json": {
    "source": "iana",
    "compressible": true
  },
  "application/jrd+json": {
    "source": "iana",
    "compressible": true
  },
  "application/jscalendar+json": {
    "source": "iana",
    "compressible": true
  },
  "application/json": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["json","map"]
  },
  "application/json-patch+json": {
    "source": "iana",
    "compressible": true
  },
  "application/json-seq": {
    "source": "iana"
  },
  "application/json5": {
    "extensions": ["json5"]
  },
  "application/jsonml+json": {
    "source": "apache",
    "compressible": true,
    "extensions": ["jsonml"]
  },
  "application/jwk+json": {
    "source": "iana",
    "compressible": true
  },
  "application/jwk-set+json": {
    "source": "iana",
    "compressible": true
  },
  "application/jwt": {
    "source": "iana"
  },
  "application/kpml-request+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/kpml-response+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/ld+json": {
    "source": "iana",
    "compressible": true,
    "extensions": ["jsonld"]
  },
  "application/lgr+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["lgr"]
  },
  "application/link-format": {
    "source": "iana"
  },
  "application/load-control+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/lost+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["lostxml"]
  },
  "application/lostsync+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/lpf+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/lxf": {
    "source": "iana"
  },
  "application/mac-binhex40": {
    "source": "iana",
    "extensions": ["hqx"]
  },
  "application/mac-compactpro": {
    "source": "apache",
    "extensions": ["cpt"]
  },
  "application/macwriteii": {
    "source": "iana"
  },
  "application/mads+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mads"]
  },
  "application/manifest+json": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["webmanifest"]
  },
  "application/marc": {
    "source": "iana",
    "extensions": ["mrc"]
  },
  "application/marcxml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mrcx"]
  },
  "application/mathematica": {
    "source": "iana",
    "extensions": ["ma","nb","mb"]
  },
  "application/mathml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mathml"]
  },
  "application/mathml-content+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mathml-presentation+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-associated-procedure-description+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-deregister+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-envelope+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-msk+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-msk-response+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-protection-description+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-reception-report+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-register+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-register-response+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-schedule+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbms-user-service-description+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mbox": {
    "source": "iana",
    "extensions": ["mbox"]
  },
  "application/media-policy-dataset+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mpf"]
  },
  "application/media_control+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mediaservercontrol+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mscml"]
  },
  "application/merge-patch+json": {
    "source": "iana",
    "compressible": true
  },
  "application/metalink+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["metalink"]
  },
  "application/metalink4+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["meta4"]
  },
  "application/mets+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mets"]
  },
  "application/mf4": {
    "source": "iana"
  },
  "application/mikey": {
    "source": "iana"
  },
  "application/mipc": {
    "source": "iana"
  },
  "application/missing-blocks+cbor-seq": {
    "source": "iana"
  },
  "application/mmt-aei+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["maei"]
  },
  "application/mmt-usd+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["musd"]
  },
  "application/mods+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mods"]
  },
  "application/moss-keys": {
    "source": "iana"
  },
  "application/moss-signature": {
    "source": "iana"
  },
  "application/mosskey-data": {
    "source": "iana"
  },
  "application/mosskey-request": {
    "source": "iana"
  },
  "application/mp21": {
    "source": "iana",
    "extensions": ["m21","mp21"]
  },
  "application/mp4": {
    "source": "iana",
    "extensions": ["mp4s","m4p"]
  },
  "application/mpeg4-generic": {
    "source": "iana"
  },
  "application/mpeg4-iod": {
    "source": "iana"
  },
  "application/mpeg4-iod-xmt": {
    "source": "iana"
  },
  "application/mrb-consumer+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/mrb-publish+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/msc-ivr+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/msc-mixer+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/msword": {
    "source": "iana",
    "compressible": false,
    "extensions": ["doc","dot"]
  },
  "application/mud+json": {
    "source": "iana",
    "compressible": true
  },
  "application/multipart-core": {
    "source": "iana"
  },
  "application/mxf": {
    "source": "iana",
    "extensions": ["mxf"]
  },
  "application/n-quads": {
    "source": "iana",
    "extensions": ["nq"]
  },
  "application/n-triples": {
    "source": "iana",
    "extensions": ["nt"]
  },
  "application/nasdata": {
    "source": "iana"
  },
  "application/news-checkgroups": {
    "source": "iana",
    "charset": "US-ASCII"
  },
  "application/news-groupinfo": {
    "source": "iana",
    "charset": "US-ASCII"
  },
  "application/news-transmission": {
    "source": "iana"
  },
  "application/nlsml+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/node": {
    "source": "iana",
    "extensions": ["cjs"]
  },
  "application/nss": {
    "source": "iana"
  },
  "application/oauth-authz-req+jwt": {
    "source": "iana"
  },
  "application/oblivious-dns-message": {
    "source": "iana"
  },
  "application/ocsp-request": {
    "source": "iana"
  },
  "application/ocsp-response": {
    "source": "iana"
  },
  "application/octet-stream": {
    "source": "iana",
    "compressible": false,
    "extensions": ["bin","dms","lrf","mar","so","dist","distz","pkg","bpk","dump","elc","deploy","exe","dll","deb","dmg","iso","img","msi","msp","msm","buffer"]
  },
  "application/oda": {
    "source": "iana",
    "extensions": ["oda"]
  },
  "application/odm+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/odx": {
    "source": "iana"
  },
  "application/oebps-package+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["opf"]
  },
  "application/ogg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["ogx"]
  },
  "application/omdoc+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["omdoc"]
  },
  "application/onenote": {
    "source": "apache",
    "extensions": ["onetoc","onetoc2","onetmp","onepkg"]
  },
  "application/opc-nodeset+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/oscore": {
    "source": "iana"
  },
  "application/oxps": {
    "source": "iana",
    "extensions": ["oxps"]
  },
  "application/p21": {
    "source": "iana"
  },
  "application/p21+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/p2p-overlay+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["relo"]
  },
  "application/parityfec": {
    "source": "iana"
  },
  "application/passport": {
    "source": "iana"
  },
  "application/patch-ops-error+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xer"]
  },
  "application/pdf": {
    "source": "iana",
    "compressible": false,
    "extensions": ["pdf"]
  },
  "application/pdx": {
    "source": "iana"
  },
  "application/pem-certificate-chain": {
    "source": "iana"
  },
  "application/pgp-encrypted": {
    "source": "iana",
    "compressible": false,
    "extensions": ["pgp"]
  },
  "application/pgp-keys": {
    "source": "iana",
    "extensions": ["asc"]
  },
  "application/pgp-signature": {
    "source": "iana",
    "extensions": ["asc","sig"]
  },
  "application/pics-rules": {
    "source": "apache",
    "extensions": ["prf"]
  },
  "application/pidf+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/pidf-diff+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/pkcs10": {
    "source": "iana",
    "extensions": ["p10"]
  },
  "application/pkcs12": {
    "source": "iana"
  },
  "application/pkcs7-mime": {
    "source": "iana",
    "extensions": ["p7m","p7c"]
  },
  "application/pkcs7-signature": {
    "source": "iana",
    "extensions": ["p7s"]
  },
  "application/pkcs8": {
    "source": "iana",
    "extensions": ["p8"]
  },
  "application/pkcs8-encrypted": {
    "source": "iana"
  },
  "application/pkix-attr-cert": {
    "source": "iana",
    "extensions": ["ac"]
  },
  "application/pkix-cert": {
    "source": "iana",
    "extensions": ["cer"]
  },
  "application/pkix-crl": {
    "source": "iana",
    "extensions": ["crl"]
  },
  "application/pkix-pkipath": {
    "source": "iana",
    "extensions": ["pkipath"]
  },
  "application/pkixcmp": {
    "source": "iana",
    "extensions": ["pki"]
  },
  "application/pls+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["pls"]
  },
  "application/poc-settings+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/postscript": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ai","eps","ps"]
  },
  "application/ppsp-tracker+json": {
    "source": "iana",
    "compressible": true
  },
  "application/problem+json": {
    "source": "iana",
    "compressible": true
  },
  "application/problem+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/provenance+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["provx"]
  },
  "application/prs.alvestrand.titrax-sheet": {
    "source": "iana"
  },
  "application/prs.cww": {
    "source": "iana",
    "extensions": ["cww"]
  },
  "application/prs.cyn": {
    "source": "iana",
    "charset": "7-BIT"
  },
  "application/prs.hpub+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/prs.nprend": {
    "source": "iana"
  },
  "application/prs.plucker": {
    "source": "iana"
  },
  "application/prs.rdf-xml-crypt": {
    "source": "iana"
  },
  "application/prs.xsf+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/pskc+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["pskcxml"]
  },
  "application/pvd+json": {
    "source": "iana",
    "compressible": true
  },
  "application/qsig": {
    "source": "iana"
  },
  "application/raml+yaml": {
    "compressible": true,
    "extensions": ["raml"]
  },
  "application/raptorfec": {
    "source": "iana"
  },
  "application/rdap+json": {
    "source": "iana",
    "compressible": true
  },
  "application/rdf+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rdf","owl"]
  },
  "application/reginfo+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rif"]
  },
  "application/relax-ng-compact-syntax": {
    "source": "iana",
    "extensions": ["rnc"]
  },
  "application/remote-printing": {
    "source": "iana"
  },
  "application/reputon+json": {
    "source": "iana",
    "compressible": true
  },
  "application/resource-lists+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rl"]
  },
  "application/resource-lists-diff+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rld"]
  },
  "application/rfc+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/riscos": {
    "source": "iana"
  },
  "application/rlmi+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/rls-services+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rs"]
  },
  "application/route-apd+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rapd"]
  },
  "application/route-s-tsid+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["sls"]
  },
  "application/route-usd+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rusd"]
  },
  "application/rpki-ghostbusters": {
    "source": "iana",
    "extensions": ["gbr"]
  },
  "application/rpki-manifest": {
    "source": "iana",
    "extensions": ["mft"]
  },
  "application/rpki-publication": {
    "source": "iana"
  },
  "application/rpki-roa": {
    "source": "iana",
    "extensions": ["roa"]
  },
  "application/rpki-updown": {
    "source": "iana"
  },
  "application/rsd+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["rsd"]
  },
  "application/rss+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["rss"]
  },
  "application/rtf": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rtf"]
  },
  "application/rtploopback": {
    "source": "iana"
  },
  "application/rtx": {
    "source": "iana"
  },
  "application/samlassertion+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/samlmetadata+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/sarif+json": {
    "source": "iana",
    "compressible": true
  },
  "application/sarif-external-properties+json": {
    "source": "iana",
    "compressible": true
  },
  "application/sbe": {
    "source": "iana"
  },
  "application/sbml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["sbml"]
  },
  "application/scaip+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/scim+json": {
    "source": "iana",
    "compressible": true
  },
  "application/scvp-cv-request": {
    "source": "iana",
    "extensions": ["scq"]
  },
  "application/scvp-cv-response": {
    "source": "iana",
    "extensions": ["scs"]
  },
  "application/scvp-vp-request": {
    "source": "iana",
    "extensions": ["spq"]
  },
  "application/scvp-vp-response": {
    "source": "iana",
    "extensions": ["spp"]
  },
  "application/sdp": {
    "source": "iana",
    "extensions": ["sdp"]
  },
  "application/secevent+jwt": {
    "source": "iana"
  },
  "application/senml+cbor": {
    "source": "iana"
  },
  "application/senml+json": {
    "source": "iana",
    "compressible": true
  },
  "application/senml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["senmlx"]
  },
  "application/senml-etch+cbor": {
    "source": "iana"
  },
  "application/senml-etch+json": {
    "source": "iana",
    "compressible": true
  },
  "application/senml-exi": {
    "source": "iana"
  },
  "application/sensml+cbor": {
    "source": "iana"
  },
  "application/sensml+json": {
    "source": "iana",
    "compressible": true
  },
  "application/sensml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["sensmlx"]
  },
  "application/sensml-exi": {
    "source": "iana"
  },
  "application/sep+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/sep-exi": {
    "source": "iana"
  },
  "application/session-info": {
    "source": "iana"
  },
  "application/set-payment": {
    "source": "iana"
  },
  "application/set-payment-initiation": {
    "source": "iana",
    "extensions": ["setpay"]
  },
  "application/set-registration": {
    "source": "iana"
  },
  "application/set-registration-initiation": {
    "source": "iana",
    "extensions": ["setreg"]
  },
  "application/sgml": {
    "source": "iana"
  },
  "application/sgml-open-catalog": {
    "source": "iana"
  },
  "application/shf+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["shf"]
  },
  "application/sieve": {
    "source": "iana",
    "extensions": ["siv","sieve"]
  },
  "application/simple-filter+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/simple-message-summary": {
    "source": "iana"
  },
  "application/simplesymbolcontainer": {
    "source": "iana"
  },
  "application/sipc": {
    "source": "iana"
  },
  "application/slate": {
    "source": "iana"
  },
  "application/smil": {
    "source": "iana"
  },
  "application/smil+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["smi","smil"]
  },
  "application/smpte336m": {
    "source": "iana"
  },
  "application/soap+fastinfoset": {
    "source": "iana"
  },
  "application/soap+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/sparql-query": {
    "source": "iana",
    "extensions": ["rq"]
  },
  "application/sparql-results+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["srx"]
  },
  "application/spdx+json": {
    "source": "iana",
    "compressible": true
  },
  "application/spirits-event+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/sql": {
    "source": "iana"
  },
  "application/srgs": {
    "source": "iana",
    "extensions": ["gram"]
  },
  "application/srgs+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["grxml"]
  },
  "application/sru+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["sru"]
  },
  "application/ssdl+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["ssdl"]
  },
  "application/ssml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ssml"]
  },
  "application/stix+json": {
    "source": "iana",
    "compressible": true
  },
  "application/swid+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["swidtag"]
  },
  "application/tamp-apex-update": {
    "source": "iana"
  },
  "application/tamp-apex-update-confirm": {
    "source": "iana"
  },
  "application/tamp-community-update": {
    "source": "iana"
  },
  "application/tamp-community-update-confirm": {
    "source": "iana"
  },
  "application/tamp-error": {
    "source": "iana"
  },
  "application/tamp-sequence-adjust": {
    "source": "iana"
  },
  "application/tamp-sequence-adjust-confirm": {
    "source": "iana"
  },
  "application/tamp-status-query": {
    "source": "iana"
  },
  "application/tamp-status-response": {
    "source": "iana"
  },
  "application/tamp-update": {
    "source": "iana"
  },
  "application/tamp-update-confirm": {
    "source": "iana"
  },
  "application/tar": {
    "compressible": true
  },
  "application/taxii+json": {
    "source": "iana",
    "compressible": true
  },
  "application/td+json": {
    "source": "iana",
    "compressible": true
  },
  "application/tei+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["tei","teicorpus"]
  },
  "application/tetra_isi": {
    "source": "iana"
  },
  "application/thraud+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["tfi"]
  },
  "application/timestamp-query": {
    "source": "iana"
  },
  "application/timestamp-reply": {
    "source": "iana"
  },
  "application/timestamped-data": {
    "source": "iana",
    "extensions": ["tsd"]
  },
  "application/tlsrpt+gzip": {
    "source": "iana"
  },
  "application/tlsrpt+json": {
    "source": "iana",
    "compressible": true
  },
  "application/tnauthlist": {
    "source": "iana"
  },
  "application/token-introspection+jwt": {
    "source": "iana"
  },
  "application/toml": {
    "compressible": true,
    "extensions": ["toml"]
  },
  "application/trickle-ice-sdpfrag": {
    "source": "iana"
  },
  "application/trig": {
    "source": "iana",
    "extensions": ["trig"]
  },
  "application/ttml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ttml"]
  },
  "application/tve-trigger": {
    "source": "iana"
  },
  "application/tzif": {
    "source": "iana"
  },
  "application/tzif-leap": {
    "source": "iana"
  },
  "application/ubjson": {
    "compressible": false,
    "extensions": ["ubj"]
  },
  "application/ulpfec": {
    "source": "iana"
  },
  "application/urc-grpsheet+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/urc-ressheet+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rsheet"]
  },
  "application/urc-targetdesc+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["td"]
  },
  "application/urc-uisocketdesc+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vcard+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vcard+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vemmi": {
    "source": "iana"
  },
  "application/vividence.scriptfile": {
    "source": "apache"
  },
  "application/vnd.1000minds.decision-model+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["1km"]
  },
  "application/vnd.3gpp-prose+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp-prose-pc3ch+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp-v2x-local-service-information": {
    "source": "iana"
  },
  "application/vnd.3gpp.5gnas": {
    "source": "iana"
  },
  "application/vnd.3gpp.access-transfer-events+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.bsf+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.gmop+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.gtpc": {
    "source": "iana"
  },
  "application/vnd.3gpp.interworking-data": {
    "source": "iana"
  },
  "application/vnd.3gpp.lpp": {
    "source": "iana"
  },
  "application/vnd.3gpp.mc-signalling-ear": {
    "source": "iana"
  },
  "application/vnd.3gpp.mcdata-affiliation-command+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcdata-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcdata-payload": {
    "source": "iana"
  },
  "application/vnd.3gpp.mcdata-service-config+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcdata-signalling": {
    "source": "iana"
  },
  "application/vnd.3gpp.mcdata-ue-config+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcdata-user-profile+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-affiliation-command+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-floor-request+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-location-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-mbms-usage-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-service-config+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-signed+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-ue-config+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-ue-init-config+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcptt-user-profile+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-affiliation-command+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-affiliation-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-location-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-mbms-usage-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-service-config+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-transmission-request+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-ue-config+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mcvideo-user-profile+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.mid-call+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.ngap": {
    "source": "iana"
  },
  "application/vnd.3gpp.pfcp": {
    "source": "iana"
  },
  "application/vnd.3gpp.pic-bw-large": {
    "source": "iana",
    "extensions": ["plb"]
  },
  "application/vnd.3gpp.pic-bw-small": {
    "source": "iana",
    "extensions": ["psb"]
  },
  "application/vnd.3gpp.pic-bw-var": {
    "source": "iana",
    "extensions": ["pvb"]
  },
  "application/vnd.3gpp.s1ap": {
    "source": "iana"
  },
  "application/vnd.3gpp.sms": {
    "source": "iana"
  },
  "application/vnd.3gpp.sms+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.srvcc-ext+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.srvcc-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.state-and-event-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp.ussd+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp2.bcmcsinfo+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.3gpp2.sms": {
    "source": "iana"
  },
  "application/vnd.3gpp2.tcap": {
    "source": "iana",
    "extensions": ["tcap"]
  },
  "application/vnd.3lightssoftware.imagescal": {
    "source": "iana"
  },
  "application/vnd.3m.post-it-notes": {
    "source": "iana",
    "extensions": ["pwn"]
  },
  "application/vnd.accpac.simply.aso": {
    "source": "iana",
    "extensions": ["aso"]
  },
  "application/vnd.accpac.simply.imp": {
    "source": "iana",
    "extensions": ["imp"]
  },
  "application/vnd.acucobol": {
    "source": "iana",
    "extensions": ["acu"]
  },
  "application/vnd.acucorp": {
    "source": "iana",
    "extensions": ["atc","acutc"]
  },
  "application/vnd.adobe.air-application-installer-package+zip": {
    "source": "apache",
    "compressible": false,
    "extensions": ["air"]
  },
  "application/vnd.adobe.flash.movie": {
    "source": "iana"
  },
  "application/vnd.adobe.formscentral.fcdt": {
    "source": "iana",
    "extensions": ["fcdt"]
  },
  "application/vnd.adobe.fxp": {
    "source": "iana",
    "extensions": ["fxp","fxpl"]
  },
  "application/vnd.adobe.partial-upload": {
    "source": "iana"
  },
  "application/vnd.adobe.xdp+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xdp"]
  },
  "application/vnd.adobe.xfdf": {
    "source": "iana",
    "extensions": ["xfdf"]
  },
  "application/vnd.aether.imp": {
    "source": "iana"
  },
  "application/vnd.afpc.afplinedata": {
    "source": "iana"
  },
  "application/vnd.afpc.afplinedata-pagedef": {
    "source": "iana"
  },
  "application/vnd.afpc.cmoca-cmresource": {
    "source": "iana"
  },
  "application/vnd.afpc.foca-charset": {
    "source": "iana"
  },
  "application/vnd.afpc.foca-codedfont": {
    "source": "iana"
  },
  "application/vnd.afpc.foca-codepage": {
    "source": "iana"
  },
  "application/vnd.afpc.modca": {
    "source": "iana"
  },
  "application/vnd.afpc.modca-cmtable": {
    "source": "iana"
  },
  "application/vnd.afpc.modca-formdef": {
    "source": "iana"
  },
  "application/vnd.afpc.modca-mediummap": {
    "source": "iana"
  },
  "application/vnd.afpc.modca-objectcontainer": {
    "source": "iana"
  },
  "application/vnd.afpc.modca-overlay": {
    "source": "iana"
  },
  "application/vnd.afpc.modca-pagesegment": {
    "source": "iana"
  },
  "application/vnd.age": {
    "source": "iana",
    "extensions": ["age"]
  },
  "application/vnd.ah-barcode": {
    "source": "iana"
  },
  "application/vnd.ahead.space": {
    "source": "iana",
    "extensions": ["ahead"]
  },
  "application/vnd.airzip.filesecure.azf": {
    "source": "iana",
    "extensions": ["azf"]
  },
  "application/vnd.airzip.filesecure.azs": {
    "source": "iana",
    "extensions": ["azs"]
  },
  "application/vnd.amadeus+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.amazon.ebook": {
    "source": "apache",
    "extensions": ["azw"]
  },
  "application/vnd.amazon.mobi8-ebook": {
    "source": "iana"
  },
  "application/vnd.americandynamics.acc": {
    "source": "iana",
    "extensions": ["acc"]
  },
  "application/vnd.amiga.ami": {
    "source": "iana",
    "extensions": ["ami"]
  },
  "application/vnd.amundsen.maze+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.android.ota": {
    "source": "iana"
  },
  "application/vnd.android.package-archive": {
    "source": "apache",
    "compressible": false,
    "extensions": ["apk"]
  },
  "application/vnd.anki": {
    "source": "iana"
  },
  "application/vnd.anser-web-certificate-issue-initiation": {
    "source": "iana",
    "extensions": ["cii"]
  },
  "application/vnd.anser-web-funds-transfer-initiation": {
    "source": "apache",
    "extensions": ["fti"]
  },
  "application/vnd.antix.game-component": {
    "source": "iana",
    "extensions": ["atx"]
  },
  "application/vnd.apache.arrow.file": {
    "source": "iana"
  },
  "application/vnd.apache.arrow.stream": {
    "source": "iana"
  },
  "application/vnd.apache.thrift.binary": {
    "source": "iana"
  },
  "application/vnd.apache.thrift.compact": {
    "source": "iana"
  },
  "application/vnd.apache.thrift.json": {
    "source": "iana"
  },
  "application/vnd.api+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.aplextor.warrp+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.apothekende.reservation+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.apple.installer+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mpkg"]
  },
  "application/vnd.apple.keynote": {
    "source": "iana",
    "extensions": ["key"]
  },
  "application/vnd.apple.mpegurl": {
    "source": "iana",
    "extensions": ["m3u8"]
  },
  "application/vnd.apple.numbers": {
    "source": "iana",
    "extensions": ["numbers"]
  },
  "application/vnd.apple.pages": {
    "source": "iana",
    "extensions": ["pages"]
  },
  "application/vnd.apple.pkpass": {
    "compressible": false,
    "extensions": ["pkpass"]
  },
  "application/vnd.arastra.swi": {
    "source": "iana"
  },
  "application/vnd.aristanetworks.swi": {
    "source": "iana",
    "extensions": ["swi"]
  },
  "application/vnd.artisan+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.artsquare": {
    "source": "iana"
  },
  "application/vnd.astraea-software.iota": {
    "source": "iana",
    "extensions": ["iota"]
  },
  "application/vnd.audiograph": {
    "source": "iana",
    "extensions": ["aep"]
  },
  "application/vnd.autopackage": {
    "source": "iana"
  },
  "application/vnd.avalon+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.avistar+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.balsamiq.bmml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["bmml"]
  },
  "application/vnd.balsamiq.bmpr": {
    "source": "iana"
  },
  "application/vnd.banana-accounting": {
    "source": "iana"
  },
  "application/vnd.bbf.usp.error": {
    "source": "iana"
  },
  "application/vnd.bbf.usp.msg": {
    "source": "iana"
  },
  "application/vnd.bbf.usp.msg+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.bekitzur-stech+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.bint.med-content": {
    "source": "iana"
  },
  "application/vnd.biopax.rdf+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.blink-idb-value-wrapper": {
    "source": "iana"
  },
  "application/vnd.blueice.multipass": {
    "source": "iana",
    "extensions": ["mpm"]
  },
  "application/vnd.bluetooth.ep.oob": {
    "source": "iana"
  },
  "application/vnd.bluetooth.le.oob": {
    "source": "iana"
  },
  "application/vnd.bmi": {
    "source": "iana",
    "extensions": ["bmi"]
  },
  "application/vnd.bpf": {
    "source": "iana"
  },
  "application/vnd.bpf3": {
    "source": "iana"
  },
  "application/vnd.businessobjects": {
    "source": "iana",
    "extensions": ["rep"]
  },
  "application/vnd.byu.uapi+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.cab-jscript": {
    "source": "iana"
  },
  "application/vnd.canon-cpdl": {
    "source": "iana"
  },
  "application/vnd.canon-lips": {
    "source": "iana"
  },
  "application/vnd.capasystems-pg+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.cendio.thinlinc.clientconf": {
    "source": "iana"
  },
  "application/vnd.century-systems.tcp_stream": {
    "source": "iana"
  },
  "application/vnd.chemdraw+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["cdxml"]
  },
  "application/vnd.chess-pgn": {
    "source": "iana"
  },
  "application/vnd.chipnuts.karaoke-mmd": {
    "source": "iana",
    "extensions": ["mmd"]
  },
  "application/vnd.ciedi": {
    "source": "iana"
  },
  "application/vnd.cinderella": {
    "source": "iana",
    "extensions": ["cdy"]
  },
  "application/vnd.cirpack.isdn-ext": {
    "source": "iana"
  },
  "application/vnd.citationstyles.style+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["csl"]
  },
  "application/vnd.claymore": {
    "source": "iana",
    "extensions": ["cla"]
  },
  "application/vnd.cloanto.rp9": {
    "source": "iana",
    "extensions": ["rp9"]
  },
  "application/vnd.clonk.c4group": {
    "source": "iana",
    "extensions": ["c4g","c4d","c4f","c4p","c4u"]
  },
  "application/vnd.cluetrust.cartomobile-config": {
    "source": "iana",
    "extensions": ["c11amc"]
  },
  "application/vnd.cluetrust.cartomobile-config-pkg": {
    "source": "iana",
    "extensions": ["c11amz"]
  },
  "application/vnd.coffeescript": {
    "source": "iana"
  },
  "application/vnd.collabio.xodocuments.document": {
    "source": "iana"
  },
  "application/vnd.collabio.xodocuments.document-template": {
    "source": "iana"
  },
  "application/vnd.collabio.xodocuments.presentation": {
    "source": "iana"
  },
  "application/vnd.collabio.xodocuments.presentation-template": {
    "source": "iana"
  },
  "application/vnd.collabio.xodocuments.spreadsheet": {
    "source": "iana"
  },
  "application/vnd.collabio.xodocuments.spreadsheet-template": {
    "source": "iana"
  },
  "application/vnd.collection+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.collection.doc+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.collection.next+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.comicbook+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.comicbook-rar": {
    "source": "iana"
  },
  "application/vnd.commerce-battelle": {
    "source": "iana"
  },
  "application/vnd.commonspace": {
    "source": "iana",
    "extensions": ["csp"]
  },
  "application/vnd.contact.cmsg": {
    "source": "iana",
    "extensions": ["cdbcmsg"]
  },
  "application/vnd.coreos.ignition+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.cosmocaller": {
    "source": "iana",
    "extensions": ["cmc"]
  },
  "application/vnd.crick.clicker": {
    "source": "iana",
    "extensions": ["clkx"]
  },
  "application/vnd.crick.clicker.keyboard": {
    "source": "iana",
    "extensions": ["clkk"]
  },
  "application/vnd.crick.clicker.palette": {
    "source": "iana",
    "extensions": ["clkp"]
  },
  "application/vnd.crick.clicker.template": {
    "source": "iana",
    "extensions": ["clkt"]
  },
  "application/vnd.crick.clicker.wordbank": {
    "source": "iana",
    "extensions": ["clkw"]
  },
  "application/vnd.criticaltools.wbs+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["wbs"]
  },
  "application/vnd.cryptii.pipe+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.crypto-shade-file": {
    "source": "iana"
  },
  "application/vnd.cryptomator.encrypted": {
    "source": "iana"
  },
  "application/vnd.cryptomator.vault": {
    "source": "iana"
  },
  "application/vnd.ctc-posml": {
    "source": "iana",
    "extensions": ["pml"]
  },
  "application/vnd.ctct.ws+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.cups-pdf": {
    "source": "iana"
  },
  "application/vnd.cups-postscript": {
    "source": "iana"
  },
  "application/vnd.cups-ppd": {
    "source": "iana",
    "extensions": ["ppd"]
  },
  "application/vnd.cups-raster": {
    "source": "iana"
  },
  "application/vnd.cups-raw": {
    "source": "iana"
  },
  "application/vnd.curl": {
    "source": "iana"
  },
  "application/vnd.curl.car": {
    "source": "apache",
    "extensions": ["car"]
  },
  "application/vnd.curl.pcurl": {
    "source": "apache",
    "extensions": ["pcurl"]
  },
  "application/vnd.cyan.dean.root+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.cybank": {
    "source": "iana"
  },
  "application/vnd.cyclonedx+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.cyclonedx+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.d2l.coursepackage1p0+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.d3m-dataset": {
    "source": "iana"
  },
  "application/vnd.d3m-problem": {
    "source": "iana"
  },
  "application/vnd.dart": {
    "source": "iana",
    "compressible": true,
    "extensions": ["dart"]
  },
  "application/vnd.data-vision.rdz": {
    "source": "iana",
    "extensions": ["rdz"]
  },
  "application/vnd.datapackage+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dataresource+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dbf": {
    "source": "iana",
    "extensions": ["dbf"]
  },
  "application/vnd.debian.binary-package": {
    "source": "iana"
  },
  "application/vnd.dece.data": {
    "source": "iana",
    "extensions": ["uvf","uvvf","uvd","uvvd"]
  },
  "application/vnd.dece.ttml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["uvt","uvvt"]
  },
  "application/vnd.dece.unspecified": {
    "source": "iana",
    "extensions": ["uvx","uvvx"]
  },
  "application/vnd.dece.zip": {
    "source": "iana",
    "extensions": ["uvz","uvvz"]
  },
  "application/vnd.denovo.fcselayout-link": {
    "source": "iana",
    "extensions": ["fe_launch"]
  },
  "application/vnd.desmume.movie": {
    "source": "iana"
  },
  "application/vnd.dir-bi.plate-dl-nosuffix": {
    "source": "iana"
  },
  "application/vnd.dm.delegation+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dna": {
    "source": "iana",
    "extensions": ["dna"]
  },
  "application/vnd.document+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dolby.mlp": {
    "source": "apache",
    "extensions": ["mlp"]
  },
  "application/vnd.dolby.mobile.1": {
    "source": "iana"
  },
  "application/vnd.dolby.mobile.2": {
    "source": "iana"
  },
  "application/vnd.doremir.scorecloud-binary-document": {
    "source": "iana"
  },
  "application/vnd.dpgraph": {
    "source": "iana",
    "extensions": ["dpg"]
  },
  "application/vnd.dreamfactory": {
    "source": "iana",
    "extensions": ["dfac"]
  },
  "application/vnd.drive+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ds-keypoint": {
    "source": "apache",
    "extensions": ["kpxx"]
  },
  "application/vnd.dtg.local": {
    "source": "iana"
  },
  "application/vnd.dtg.local.flash": {
    "source": "iana"
  },
  "application/vnd.dtg.local.html": {
    "source": "iana"
  },
  "application/vnd.dvb.ait": {
    "source": "iana",
    "extensions": ["ait"]
  },
  "application/vnd.dvb.dvbisl+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dvb.dvbj": {
    "source": "iana"
  },
  "application/vnd.dvb.esgcontainer": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcdftnotifaccess": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcesgaccess": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcesgaccess2": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcesgpdd": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcroaming": {
    "source": "iana"
  },
  "application/vnd.dvb.iptv.alfec-base": {
    "source": "iana"
  },
  "application/vnd.dvb.iptv.alfec-enhancement": {
    "source": "iana"
  },
  "application/vnd.dvb.notif-aggregate-root+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dvb.notif-container+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dvb.notif-generic+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dvb.notif-ia-msglist+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dvb.notif-ia-registration-request+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dvb.notif-ia-registration-response+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dvb.notif-init+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dvb.pfr": {
    "source": "iana"
  },
  "application/vnd.dvb.service": {
    "source": "iana",
    "extensions": ["svc"]
  },
  "application/vnd.dxr": {
    "source": "iana"
  },
  "application/vnd.dynageo": {
    "source": "iana",
    "extensions": ["geo"]
  },
  "application/vnd.dzr": {
    "source": "iana"
  },
  "application/vnd.easykaraoke.cdgdownload": {
    "source": "iana"
  },
  "application/vnd.ecdis-update": {
    "source": "iana"
  },
  "application/vnd.ecip.rlp": {
    "source": "iana"
  },
  "application/vnd.eclipse.ditto+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ecowin.chart": {
    "source": "iana",
    "extensions": ["mag"]
  },
  "application/vnd.ecowin.filerequest": {
    "source": "iana"
  },
  "application/vnd.ecowin.fileupdate": {
    "source": "iana"
  },
  "application/vnd.ecowin.series": {
    "source": "iana"
  },
  "application/vnd.ecowin.seriesrequest": {
    "source": "iana"
  },
  "application/vnd.ecowin.seriesupdate": {
    "source": "iana"
  },
  "application/vnd.efi.img": {
    "source": "iana"
  },
  "application/vnd.efi.iso": {
    "source": "iana"
  },
  "application/vnd.emclient.accessrequest+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.enliven": {
    "source": "iana",
    "extensions": ["nml"]
  },
  "application/vnd.enphase.envoy": {
    "source": "iana"
  },
  "application/vnd.eprints.data+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.epson.esf": {
    "source": "iana",
    "extensions": ["esf"]
  },
  "application/vnd.epson.msf": {
    "source": "iana",
    "extensions": ["msf"]
  },
  "application/vnd.epson.quickanime": {
    "source": "iana",
    "extensions": ["qam"]
  },
  "application/vnd.epson.salt": {
    "source": "iana",
    "extensions": ["slt"]
  },
  "application/vnd.epson.ssf": {
    "source": "iana",
    "extensions": ["ssf"]
  },
  "application/vnd.ericsson.quickcall": {
    "source": "iana"
  },
  "application/vnd.espass-espass+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.eszigno3+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["es3","et3"]
  },
  "application/vnd.etsi.aoc+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.asic-e+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.etsi.asic-s+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.etsi.cug+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvcommand+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvdiscovery+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvprofile+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvsad-bc+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvsad-cod+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvsad-npvr+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvservice+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvsync+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.iptvueprofile+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.mcid+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.mheg5": {
    "source": "iana"
  },
  "application/vnd.etsi.overload-control-policy-dataset+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.pstn+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.sci+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.simservs+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.timestamp-token": {
    "source": "iana"
  },
  "application/vnd.etsi.tsl+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.etsi.tsl.der": {
    "source": "iana"
  },
  "application/vnd.eu.kasparian.car+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.eudora.data": {
    "source": "iana"
  },
  "application/vnd.evolv.ecig.profile": {
    "source": "iana"
  },
  "application/vnd.evolv.ecig.settings": {
    "source": "iana"
  },
  "application/vnd.evolv.ecig.theme": {
    "source": "iana"
  },
  "application/vnd.exstream-empower+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.exstream-package": {
    "source": "iana"
  },
  "application/vnd.ezpix-album": {
    "source": "iana",
    "extensions": ["ez2"]
  },
  "application/vnd.ezpix-package": {
    "source": "iana",
    "extensions": ["ez3"]
  },
  "application/vnd.f-secure.mobile": {
    "source": "iana"
  },
  "application/vnd.familysearch.gedcom+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.fastcopy-disk-image": {
    "source": "iana"
  },
  "application/vnd.fdf": {
    "source": "iana",
    "extensions": ["fdf"]
  },
  "application/vnd.fdsn.mseed": {
    "source": "iana",
    "extensions": ["mseed"]
  },
  "application/vnd.fdsn.seed": {
    "source": "iana",
    "extensions": ["seed","dataless"]
  },
  "application/vnd.ffsns": {
    "source": "iana"
  },
  "application/vnd.ficlab.flb+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.filmit.zfc": {
    "source": "iana"
  },
  "application/vnd.fints": {
    "source": "iana"
  },
  "application/vnd.firemonkeys.cloudcell": {
    "source": "iana"
  },
  "application/vnd.flographit": {
    "source": "iana",
    "extensions": ["gph"]
  },
  "application/vnd.fluxtime.clip": {
    "source": "iana",
    "extensions": ["ftc"]
  },
  "application/vnd.font-fontforge-sfd": {
    "source": "iana"
  },
  "application/vnd.framemaker": {
    "source": "iana",
    "extensions": ["fm","frame","maker","book"]
  },
  "application/vnd.frogans.fnc": {
    "source": "iana",
    "extensions": ["fnc"]
  },
  "application/vnd.frogans.ltf": {
    "source": "iana",
    "extensions": ["ltf"]
  },
  "application/vnd.fsc.weblaunch": {
    "source": "iana",
    "extensions": ["fsc"]
  },
  "application/vnd.fujifilm.fb.docuworks": {
    "source": "iana"
  },
  "application/vnd.fujifilm.fb.docuworks.binder": {
    "source": "iana"
  },
  "application/vnd.fujifilm.fb.docuworks.container": {
    "source": "iana"
  },
  "application/vnd.fujifilm.fb.jfi+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.fujitsu.oasys": {
    "source": "iana",
    "extensions": ["oas"]
  },
  "application/vnd.fujitsu.oasys2": {
    "source": "iana",
    "extensions": ["oa2"]
  },
  "application/vnd.fujitsu.oasys3": {
    "source": "iana",
    "extensions": ["oa3"]
  },
  "application/vnd.fujitsu.oasysgp": {
    "source": "iana",
    "extensions": ["fg5"]
  },
  "application/vnd.fujitsu.oasysprs": {
    "source": "iana",
    "extensions": ["bh2"]
  },
  "application/vnd.fujixerox.art-ex": {
    "source": "iana"
  },
  "application/vnd.fujixerox.art4": {
    "source": "iana"
  },
  "application/vnd.fujixerox.ddd": {
    "source": "iana",
    "extensions": ["ddd"]
  },
  "application/vnd.fujixerox.docuworks": {
    "source": "iana",
    "extensions": ["xdw"]
  },
  "application/vnd.fujixerox.docuworks.binder": {
    "source": "iana",
    "extensions": ["xbd"]
  },
  "application/vnd.fujixerox.docuworks.container": {
    "source": "iana"
  },
  "application/vnd.fujixerox.hbpl": {
    "source": "iana"
  },
  "application/vnd.fut-misnet": {
    "source": "iana"
  },
  "application/vnd.futoin+cbor": {
    "source": "iana"
  },
  "application/vnd.futoin+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.fuzzysheet": {
    "source": "iana",
    "extensions": ["fzs"]
  },
  "application/vnd.genomatix.tuxedo": {
    "source": "iana",
    "extensions": ["txd"]
  },
  "application/vnd.gentics.grd+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.geo+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.geocube+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.geogebra.file": {
    "source": "iana",
    "extensions": ["ggb"]
  },
  "application/vnd.geogebra.slides": {
    "source": "iana"
  },
  "application/vnd.geogebra.tool": {
    "source": "iana",
    "extensions": ["ggt"]
  },
  "application/vnd.geometry-explorer": {
    "source": "iana",
    "extensions": ["gex","gre"]
  },
  "application/vnd.geonext": {
    "source": "iana",
    "extensions": ["gxt"]
  },
  "application/vnd.geoplan": {
    "source": "iana",
    "extensions": ["g2w"]
  },
  "application/vnd.geospace": {
    "source": "iana",
    "extensions": ["g3w"]
  },
  "application/vnd.gerber": {
    "source": "iana"
  },
  "application/vnd.globalplatform.card-content-mgt": {
    "source": "iana"
  },
  "application/vnd.globalplatform.card-content-mgt-response": {
    "source": "iana"
  },
  "application/vnd.gmx": {
    "source": "iana",
    "extensions": ["gmx"]
  },
  "application/vnd.google-apps.document": {
    "compressible": false,
    "extensions": ["gdoc"]
  },
  "application/vnd.google-apps.presentation": {
    "compressible": false,
    "extensions": ["gslides"]
  },
  "application/vnd.google-apps.spreadsheet": {
    "compressible": false,
    "extensions": ["gsheet"]
  },
  "application/vnd.google-earth.kml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["kml"]
  },
  "application/vnd.google-earth.kmz": {
    "source": "iana",
    "compressible": false,
    "extensions": ["kmz"]
  },
  "application/vnd.gov.sk.e-form+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.gov.sk.e-form+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.gov.sk.xmldatacontainer+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.grafeq": {
    "source": "iana",
    "extensions": ["gqf","gqs"]
  },
  "application/vnd.gridmp": {
    "source": "iana"
  },
  "application/vnd.groove-account": {
    "source": "iana",
    "extensions": ["gac"]
  },
  "application/vnd.groove-help": {
    "source": "iana",
    "extensions": ["ghf"]
  },
  "application/vnd.groove-identity-message": {
    "source": "iana",
    "extensions": ["gim"]
  },
  "application/vnd.groove-injector": {
    "source": "iana",
    "extensions": ["grv"]
  },
  "application/vnd.groove-tool-message": {
    "source": "iana",
    "extensions": ["gtm"]
  },
  "application/vnd.groove-tool-template": {
    "source": "iana",
    "extensions": ["tpl"]
  },
  "application/vnd.groove-vcard": {
    "source": "iana",
    "extensions": ["vcg"]
  },
  "application/vnd.hal+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hal+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["hal"]
  },
  "application/vnd.handheld-entertainment+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["zmm"]
  },
  "application/vnd.hbci": {
    "source": "iana",
    "extensions": ["hbci"]
  },
  "application/vnd.hc+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hcl-bireports": {
    "source": "iana"
  },
  "application/vnd.hdt": {
    "source": "iana"
  },
  "application/vnd.heroku+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hhe.lesson-player": {
    "source": "iana",
    "extensions": ["les"]
  },
  "application/vnd.hl7cda+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/vnd.hl7v2+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/vnd.hp-hpgl": {
    "source": "iana",
    "extensions": ["hpgl"]
  },
  "application/vnd.hp-hpid": {
    "source": "iana",
    "extensions": ["hpid"]
  },
  "application/vnd.hp-hps": {
    "source": "iana",
    "extensions": ["hps"]
  },
  "application/vnd.hp-jlyt": {
    "source": "iana",
    "extensions": ["jlt"]
  },
  "application/vnd.hp-pcl": {
    "source": "iana",
    "extensions": ["pcl"]
  },
  "application/vnd.hp-pclxl": {
    "source": "iana",
    "extensions": ["pclxl"]
  },
  "application/vnd.httphone": {
    "source": "iana"
  },
  "application/vnd.hydrostatix.sof-data": {
    "source": "iana",
    "extensions": ["sfd-hdstx"]
  },
  "application/vnd.hyper+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hyper-item+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hyperdrive+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hzn-3d-crossword": {
    "source": "iana"
  },
  "application/vnd.ibm.afplinedata": {
    "source": "iana"
  },
  "application/vnd.ibm.electronic-media": {
    "source": "iana"
  },
  "application/vnd.ibm.minipay": {
    "source": "iana",
    "extensions": ["mpy"]
  },
  "application/vnd.ibm.modcap": {
    "source": "iana",
    "extensions": ["afp","listafp","list3820"]
  },
  "application/vnd.ibm.rights-management": {
    "source": "iana",
    "extensions": ["irm"]
  },
  "application/vnd.ibm.secure-container": {
    "source": "iana",
    "extensions": ["sc"]
  },
  "application/vnd.iccprofile": {
    "source": "iana",
    "extensions": ["icc","icm"]
  },
  "application/vnd.ieee.1905": {
    "source": "iana"
  },
  "application/vnd.igloader": {
    "source": "iana",
    "extensions": ["igl"]
  },
  "application/vnd.imagemeter.folder+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.imagemeter.image+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.immervision-ivp": {
    "source": "iana",
    "extensions": ["ivp"]
  },
  "application/vnd.immervision-ivu": {
    "source": "iana",
    "extensions": ["ivu"]
  },
  "application/vnd.ims.imsccv1p1": {
    "source": "iana"
  },
  "application/vnd.ims.imsccv1p2": {
    "source": "iana"
  },
  "application/vnd.ims.imsccv1p3": {
    "source": "iana"
  },
  "application/vnd.ims.lis.v2.result+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolconsumerprofile+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolproxy+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolproxy.id+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolsettings+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolsettings.simple+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.informedcontrol.rms+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.informix-visionary": {
    "source": "iana"
  },
  "application/vnd.infotech.project": {
    "source": "iana"
  },
  "application/vnd.infotech.project+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.innopath.wamp.notification": {
    "source": "iana"
  },
  "application/vnd.insors.igm": {
    "source": "iana",
    "extensions": ["igm"]
  },
  "application/vnd.intercon.formnet": {
    "source": "iana",
    "extensions": ["xpw","xpx"]
  },
  "application/vnd.intergeo": {
    "source": "iana",
    "extensions": ["i2g"]
  },
  "application/vnd.intertrust.digibox": {
    "source": "iana"
  },
  "application/vnd.intertrust.nncp": {
    "source": "iana"
  },
  "application/vnd.intu.qbo": {
    "source": "iana",
    "extensions": ["qbo"]
  },
  "application/vnd.intu.qfx": {
    "source": "iana",
    "extensions": ["qfx"]
  },
  "application/vnd.iptc.g2.catalogitem+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.iptc.g2.conceptitem+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.iptc.g2.knowledgeitem+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.iptc.g2.newsitem+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.iptc.g2.newsmessage+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.iptc.g2.packageitem+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.iptc.g2.planningitem+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ipunplugged.rcprofile": {
    "source": "iana",
    "extensions": ["rcprofile"]
  },
  "application/vnd.irepository.package+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["irp"]
  },
  "application/vnd.is-xpr": {
    "source": "iana",
    "extensions": ["xpr"]
  },
  "application/vnd.isac.fcs": {
    "source": "iana",
    "extensions": ["fcs"]
  },
  "application/vnd.iso11783-10+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.jam": {
    "source": "iana",
    "extensions": ["jam"]
  },
  "application/vnd.japannet-directory-service": {
    "source": "iana"
  },
  "application/vnd.japannet-jpnstore-wakeup": {
    "source": "iana"
  },
  "application/vnd.japannet-payment-wakeup": {
    "source": "iana"
  },
  "application/vnd.japannet-registration": {
    "source": "iana"
  },
  "application/vnd.japannet-registration-wakeup": {
    "source": "iana"
  },
  "application/vnd.japannet-setstore-wakeup": {
    "source": "iana"
  },
  "application/vnd.japannet-verification": {
    "source": "iana"
  },
  "application/vnd.japannet-verification-wakeup": {
    "source": "iana"
  },
  "application/vnd.jcp.javame.midlet-rms": {
    "source": "iana",
    "extensions": ["rms"]
  },
  "application/vnd.jisp": {
    "source": "iana",
    "extensions": ["jisp"]
  },
  "application/vnd.joost.joda-archive": {
    "source": "iana",
    "extensions": ["joda"]
  },
  "application/vnd.jsk.isdn-ngn": {
    "source": "iana"
  },
  "application/vnd.kahootz": {
    "source": "iana",
    "extensions": ["ktz","ktr"]
  },
  "application/vnd.kde.karbon": {
    "source": "iana",
    "extensions": ["karbon"]
  },
  "application/vnd.kde.kchart": {
    "source": "iana",
    "extensions": ["chrt"]
  },
  "application/vnd.kde.kformula": {
    "source": "iana",
    "extensions": ["kfo"]
  },
  "application/vnd.kde.kivio": {
    "source": "iana",
    "extensions": ["flw"]
  },
  "application/vnd.kde.kontour": {
    "source": "iana",
    "extensions": ["kon"]
  },
  "application/vnd.kde.kpresenter": {
    "source": "iana",
    "extensions": ["kpr","kpt"]
  },
  "application/vnd.kde.kspread": {
    "source": "iana",
    "extensions": ["ksp"]
  },
  "application/vnd.kde.kword": {
    "source": "iana",
    "extensions": ["kwd","kwt"]
  },
  "application/vnd.kenameaapp": {
    "source": "iana",
    "extensions": ["htke"]
  },
  "application/vnd.kidspiration": {
    "source": "iana",
    "extensions": ["kia"]
  },
  "application/vnd.kinar": {
    "source": "iana",
    "extensions": ["kne","knp"]
  },
  "application/vnd.koan": {
    "source": "iana",
    "extensions": ["skp","skd","skt","skm"]
  },
  "application/vnd.kodak-descriptor": {
    "source": "iana",
    "extensions": ["sse"]
  },
  "application/vnd.las": {
    "source": "iana"
  },
  "application/vnd.las.las+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.las.las+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["lasxml"]
  },
  "application/vnd.laszip": {
    "source": "iana"
  },
  "application/vnd.leap+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.liberty-request+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.llamagraphics.life-balance.desktop": {
    "source": "iana",
    "extensions": ["lbd"]
  },
  "application/vnd.llamagraphics.life-balance.exchange+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["lbe"]
  },
  "application/vnd.logipipe.circuit+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.loom": {
    "source": "iana"
  },
  "application/vnd.lotus-1-2-3": {
    "source": "iana",
    "extensions": ["123"]
  },
  "application/vnd.lotus-approach": {
    "source": "iana",
    "extensions": ["apr"]
  },
  "application/vnd.lotus-freelance": {
    "source": "iana",
    "extensions": ["pre"]
  },
  "application/vnd.lotus-notes": {
    "source": "iana",
    "extensions": ["nsf"]
  },
  "application/vnd.lotus-organizer": {
    "source": "iana",
    "extensions": ["org"]
  },
  "application/vnd.lotus-screencam": {
    "source": "iana",
    "extensions": ["scm"]
  },
  "application/vnd.lotus-wordpro": {
    "source": "iana",
    "extensions": ["lwp"]
  },
  "application/vnd.macports.portpkg": {
    "source": "iana",
    "extensions": ["portpkg"]
  },
  "application/vnd.mapbox-vector-tile": {
    "source": "iana",
    "extensions": ["mvt"]
  },
  "application/vnd.marlin.drm.actiontoken+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.marlin.drm.conftoken+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.marlin.drm.license+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.marlin.drm.mdcf": {
    "source": "iana"
  },
  "application/vnd.mason+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.maxar.archive.3tz+zip": {
    "source": "iana",
    "compressible": false
  },
  "application/vnd.maxmind.maxmind-db": {
    "source": "iana"
  },
  "application/vnd.mcd": {
    "source": "iana",
    "extensions": ["mcd"]
  },
  "application/vnd.medcalcdata": {
    "source": "iana",
    "extensions": ["mc1"]
  },
  "application/vnd.mediastation.cdkey": {
    "source": "iana",
    "extensions": ["cdkey"]
  },
  "application/vnd.meridian-slingshot": {
    "source": "iana"
  },
  "application/vnd.mfer": {
    "source": "iana",
    "extensions": ["mwf"]
  },
  "application/vnd.mfmp": {
    "source": "iana",
    "extensions": ["mfm"]
  },
  "application/vnd.micro+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.micrografx.flo": {
    "source": "iana",
    "extensions": ["flo"]
  },
  "application/vnd.micrografx.igx": {
    "source": "iana",
    "extensions": ["igx"]
  },
  "application/vnd.microsoft.portable-executable": {
    "source": "iana"
  },
  "application/vnd.microsoft.windows.thumbnail-cache": {
    "source": "iana"
  },
  "application/vnd.miele+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.mif": {
    "source": "iana",
    "extensions": ["mif"]
  },
  "application/vnd.minisoft-hp3000-save": {
    "source": "iana"
  },
  "application/vnd.mitsubishi.misty-guard.trustweb": {
    "source": "iana"
  },
  "application/vnd.mobius.daf": {
    "source": "iana",
    "extensions": ["daf"]
  },
  "application/vnd.mobius.dis": {
    "source": "iana",
    "extensions": ["dis"]
  },
  "application/vnd.mobius.mbk": {
    "source": "iana",
    "extensions": ["mbk"]
  },
  "application/vnd.mobius.mqy": {
    "source": "iana",
    "extensions": ["mqy"]
  },
  "application/vnd.mobius.msl": {
    "source": "iana",
    "extensions": ["msl"]
  },
  "application/vnd.mobius.plc": {
    "source": "iana",
    "extensions": ["plc"]
  },
  "application/vnd.mobius.txf": {
    "source": "iana",
    "extensions": ["txf"]
  },
  "application/vnd.mophun.application": {
    "source": "iana",
    "extensions": ["mpn"]
  },
  "application/vnd.mophun.certificate": {
    "source": "iana",
    "extensions": ["mpc"]
  },
  "application/vnd.motorola.flexsuite": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.adsi": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.fis": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.gotap": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.kmr": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.ttc": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.wem": {
    "source": "iana"
  },
  "application/vnd.motorola.iprm": {
    "source": "iana"
  },
  "application/vnd.mozilla.xul+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xul"]
  },
  "application/vnd.ms-3mfdocument": {
    "source": "iana"
  },
  "application/vnd.ms-artgalry": {
    "source": "iana",
    "extensions": ["cil"]
  },
  "application/vnd.ms-asf": {
    "source": "iana"
  },
  "application/vnd.ms-cab-compressed": {
    "source": "iana",
    "extensions": ["cab"]
  },
  "application/vnd.ms-color.iccprofile": {
    "source": "apache"
  },
  "application/vnd.ms-excel": {
    "source": "iana",
    "compressible": false,
    "extensions": ["xls","xlm","xla","xlc","xlt","xlw"]
  },
  "application/vnd.ms-excel.addin.macroenabled.12": {
    "source": "iana",
    "extensions": ["xlam"]
  },
  "application/vnd.ms-excel.sheet.binary.macroenabled.12": {
    "source": "iana",
    "extensions": ["xlsb"]
  },
  "application/vnd.ms-excel.sheet.macroenabled.12": {
    "source": "iana",
    "extensions": ["xlsm"]
  },
  "application/vnd.ms-excel.template.macroenabled.12": {
    "source": "iana",
    "extensions": ["xltm"]
  },
  "application/vnd.ms-fontobject": {
    "source": "iana",
    "compressible": true,
    "extensions": ["eot"]
  },
  "application/vnd.ms-htmlhelp": {
    "source": "iana",
    "extensions": ["chm"]
  },
  "application/vnd.ms-ims": {
    "source": "iana",
    "extensions": ["ims"]
  },
  "application/vnd.ms-lrm": {
    "source": "iana",
    "extensions": ["lrm"]
  },
  "application/vnd.ms-office.activex+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ms-officetheme": {
    "source": "iana",
    "extensions": ["thmx"]
  },
  "application/vnd.ms-opentype": {
    "source": "apache",
    "compressible": true
  },
  "application/vnd.ms-outlook": {
    "compressible": false,
    "extensions": ["msg"]
  },
  "application/vnd.ms-package.obfuscated-opentype": {
    "source": "apache"
  },
  "application/vnd.ms-pki.seccat": {
    "source": "apache",
    "extensions": ["cat"]
  },
  "application/vnd.ms-pki.stl": {
    "source": "apache",
    "extensions": ["stl"]
  },
  "application/vnd.ms-playready.initiator+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ms-powerpoint": {
    "source": "iana",
    "compressible": false,
    "extensions": ["ppt","pps","pot"]
  },
  "application/vnd.ms-powerpoint.addin.macroenabled.12": {
    "source": "iana",
    "extensions": ["ppam"]
  },
  "application/vnd.ms-powerpoint.presentation.macroenabled.12": {
    "source": "iana",
    "extensions": ["pptm"]
  },
  "application/vnd.ms-powerpoint.slide.macroenabled.12": {
    "source": "iana",
    "extensions": ["sldm"]
  },
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
    "source": "iana",
    "extensions": ["ppsm"]
  },
  "application/vnd.ms-powerpoint.template.macroenabled.12": {
    "source": "iana",
    "extensions": ["potm"]
  },
  "application/vnd.ms-printdevicecapabilities+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ms-printing.printticket+xml": {
    "source": "apache",
    "compressible": true
  },
  "application/vnd.ms-printschematicket+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ms-project": {
    "source": "iana",
    "extensions": ["mpp","mpt"]
  },
  "application/vnd.ms-tnef": {
    "source": "iana"
  },
  "application/vnd.ms-windows.devicepairing": {
    "source": "iana"
  },
  "application/vnd.ms-windows.nwprinting.oob": {
    "source": "iana"
  },
  "application/vnd.ms-windows.printerpairing": {
    "source": "iana"
  },
  "application/vnd.ms-windows.wsd.oob": {
    "source": "iana"
  },
  "application/vnd.ms-wmdrm.lic-chlg-req": {
    "source": "iana"
  },
  "application/vnd.ms-wmdrm.lic-resp": {
    "source": "iana"
  },
  "application/vnd.ms-wmdrm.meter-chlg-req": {
    "source": "iana"
  },
  "application/vnd.ms-wmdrm.meter-resp": {
    "source": "iana"
  },
  "application/vnd.ms-word.document.macroenabled.12": {
    "source": "iana",
    "extensions": ["docm"]
  },
  "application/vnd.ms-word.template.macroenabled.12": {
    "source": "iana",
    "extensions": ["dotm"]
  },
  "application/vnd.ms-works": {
    "source": "iana",
    "extensions": ["wps","wks","wcm","wdb"]
  },
  "application/vnd.ms-wpl": {
    "source": "iana",
    "extensions": ["wpl"]
  },
  "application/vnd.ms-xpsdocument": {
    "source": "iana",
    "compressible": false,
    "extensions": ["xps"]
  },
  "application/vnd.msa-disk-image": {
    "source": "iana"
  },
  "application/vnd.mseq": {
    "source": "iana",
    "extensions": ["mseq"]
  },
  "application/vnd.msign": {
    "source": "iana"
  },
  "application/vnd.multiad.creator": {
    "source": "iana"
  },
  "application/vnd.multiad.creator.cif": {
    "source": "iana"
  },
  "application/vnd.music-niff": {
    "source": "iana"
  },
  "application/vnd.musician": {
    "source": "iana",
    "extensions": ["mus"]
  },
  "application/vnd.muvee.style": {
    "source": "iana",
    "extensions": ["msty"]
  },
  "application/vnd.mynfc": {
    "source": "iana",
    "extensions": ["taglet"]
  },
  "application/vnd.nacamar.ybrid+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ncd.control": {
    "source": "iana"
  },
  "application/vnd.ncd.reference": {
    "source": "iana"
  },
  "application/vnd.nearst.inv+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.nebumind.line": {
    "source": "iana"
  },
  "application/vnd.nervana": {
    "source": "iana"
  },
  "application/vnd.netfpx": {
    "source": "iana"
  },
  "application/vnd.neurolanguage.nlu": {
    "source": "iana",
    "extensions": ["nlu"]
  },
  "application/vnd.nimn": {
    "source": "iana"
  },
  "application/vnd.nintendo.nitro.rom": {
    "source": "iana"
  },
  "application/vnd.nintendo.snes.rom": {
    "source": "iana"
  },
  "application/vnd.nitf": {
    "source": "iana",
    "extensions": ["ntf","nitf"]
  },
  "application/vnd.noblenet-directory": {
    "source": "iana",
    "extensions": ["nnd"]
  },
  "application/vnd.noblenet-sealer": {
    "source": "iana",
    "extensions": ["nns"]
  },
  "application/vnd.noblenet-web": {
    "source": "iana",
    "extensions": ["nnw"]
  },
  "application/vnd.nokia.catalogs": {
    "source": "iana"
  },
  "application/vnd.nokia.conml+wbxml": {
    "source": "iana"
  },
  "application/vnd.nokia.conml+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.nokia.iptv.config+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.nokia.isds-radio-presets": {
    "source": "iana"
  },
  "application/vnd.nokia.landmark+wbxml": {
    "source": "iana"
  },
  "application/vnd.nokia.landmark+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.nokia.landmarkcollection+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.nokia.n-gage.ac+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ac"]
  },
  "application/vnd.nokia.n-gage.data": {
    "source": "iana",
    "extensions": ["ngdat"]
  },
  "application/vnd.nokia.n-gage.symbian.install": {
    "source": "iana",
    "extensions": ["n-gage"]
  },
  "application/vnd.nokia.ncd": {
    "source": "iana"
  },
  "application/vnd.nokia.pcd+wbxml": {
    "source": "iana"
  },
  "application/vnd.nokia.pcd+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.nokia.radio-preset": {
    "source": "iana",
    "extensions": ["rpst"]
  },
  "application/vnd.nokia.radio-presets": {
    "source": "iana",
    "extensions": ["rpss"]
  },
  "application/vnd.novadigm.edm": {
    "source": "iana",
    "extensions": ["edm"]
  },
  "application/vnd.novadigm.edx": {
    "source": "iana",
    "extensions": ["edx"]
  },
  "application/vnd.novadigm.ext": {
    "source": "iana",
    "extensions": ["ext"]
  },
  "application/vnd.ntt-local.content-share": {
    "source": "iana"
  },
  "application/vnd.ntt-local.file-transfer": {
    "source": "iana"
  },
  "application/vnd.ntt-local.ogw_remote-access": {
    "source": "iana"
  },
  "application/vnd.ntt-local.sip-ta_remote": {
    "source": "iana"
  },
  "application/vnd.ntt-local.sip-ta_tcp_stream": {
    "source": "iana"
  },
  "application/vnd.oasis.opendocument.chart": {
    "source": "iana",
    "extensions": ["odc"]
  },
  "application/vnd.oasis.opendocument.chart-template": {
    "source": "iana",
    "extensions": ["otc"]
  },
  "application/vnd.oasis.opendocument.database": {
    "source": "iana",
    "extensions": ["odb"]
  },
  "application/vnd.oasis.opendocument.formula": {
    "source": "iana",
    "extensions": ["odf"]
  },
  "application/vnd.oasis.opendocument.formula-template": {
    "source": "iana",
    "extensions": ["odft"]
  },
  "application/vnd.oasis.opendocument.graphics": {
    "source": "iana",
    "compressible": false,
    "extensions": ["odg"]
  },
  "application/vnd.oasis.opendocument.graphics-template": {
    "source": "iana",
    "extensions": ["otg"]
  },
  "application/vnd.oasis.opendocument.image": {
    "source": "iana",
    "extensions": ["odi"]
  },
  "application/vnd.oasis.opendocument.image-template": {
    "source": "iana",
    "extensions": ["oti"]
  },
  "application/vnd.oasis.opendocument.presentation": {
    "source": "iana",
    "compressible": false,
    "extensions": ["odp"]
  },
  "application/vnd.oasis.opendocument.presentation-template": {
    "source": "iana",
    "extensions": ["otp"]
  },
  "application/vnd.oasis.opendocument.spreadsheet": {
    "source": "iana",
    "compressible": false,
    "extensions": ["ods"]
  },
  "application/vnd.oasis.opendocument.spreadsheet-template": {
    "source": "iana",
    "extensions": ["ots"]
  },
  "application/vnd.oasis.opendocument.text": {
    "source": "iana",
    "compressible": false,
    "extensions": ["odt"]
  },
  "application/vnd.oasis.opendocument.text-master": {
    "source": "iana",
    "extensions": ["odm"]
  },
  "application/vnd.oasis.opendocument.text-template": {
    "source": "iana",
    "extensions": ["ott"]
  },
  "application/vnd.oasis.opendocument.text-web": {
    "source": "iana",
    "extensions": ["oth"]
  },
  "application/vnd.obn": {
    "source": "iana"
  },
  "application/vnd.ocf+cbor": {
    "source": "iana"
  },
  "application/vnd.oci.image.manifest.v1+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oftn.l10n+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.contentaccessdownload+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.contentaccessstreaming+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.cspg-hexbinary": {
    "source": "iana"
  },
  "application/vnd.oipf.dae.svg+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.dae.xhtml+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.mippvcontrolmessage+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.pae.gem": {
    "source": "iana"
  },
  "application/vnd.oipf.spdiscovery+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.spdlist+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.ueprofile+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.userprofile+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.olpc-sugar": {
    "source": "iana",
    "extensions": ["xo"]
  },
  "application/vnd.oma-scws-config": {
    "source": "iana"
  },
  "application/vnd.oma-scws-http-request": {
    "source": "iana"
  },
  "application/vnd.oma-scws-http-response": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.associated-procedure-parameter+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.bcast.drm-trigger+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.bcast.imd+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.bcast.ltkm": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.notification+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.bcast.provisioningtrigger": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.sgboot": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.sgdd+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.bcast.sgdu": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.simple-symbol-container": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.smartcard-trigger+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.bcast.sprov+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.bcast.stkm": {
    "source": "iana"
  },
  "application/vnd.oma.cab-address-book+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.cab-feature-handler+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.cab-pcc+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.cab-subs-invite+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.cab-user-prefs+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.dcd": {
    "source": "iana"
  },
  "application/vnd.oma.dcdc": {
    "source": "iana"
  },
  "application/vnd.oma.dd2+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["dd2"]
  },
  "application/vnd.oma.drm.risd+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.group-usage-list+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.lwm2m+cbor": {
    "source": "iana"
  },
  "application/vnd.oma.lwm2m+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.lwm2m+tlv": {
    "source": "iana"
  },
  "application/vnd.oma.pal+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.poc.detailed-progress-report+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.poc.final-report+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.poc.groups+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.poc.invocation-descriptor+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.poc.optimized-progress-report+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.push": {
    "source": "iana"
  },
  "application/vnd.oma.scidm.messages+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.xcap-directory+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.omads-email+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/vnd.omads-file+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/vnd.omads-folder+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/vnd.omaloc-supl-init": {
    "source": "iana"
  },
  "application/vnd.onepager": {
    "source": "iana"
  },
  "application/vnd.onepagertamp": {
    "source": "iana"
  },
  "application/vnd.onepagertamx": {
    "source": "iana"
  },
  "application/vnd.onepagertat": {
    "source": "iana"
  },
  "application/vnd.onepagertatp": {
    "source": "iana"
  },
  "application/vnd.onepagertatx": {
    "source": "iana"
  },
  "application/vnd.openblox.game+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["obgx"]
  },
  "application/vnd.openblox.game-binary": {
    "source": "iana"
  },
  "application/vnd.openeye.oeb": {
    "source": "iana"
  },
  "application/vnd.openofficeorg.extension": {
    "source": "apache",
    "extensions": ["oxt"]
  },
  "application/vnd.openstreetmap.data+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["osm"]
  },
  "application/vnd.opentimestamps.ots": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.custom-properties+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.drawing+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.extended-properties+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.comments+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    "source": "iana",
    "compressible": false,
    "extensions": ["pptx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slide": {
    "source": "iana",
    "extensions": ["sldx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
    "source": "iana",
    "extensions": ["ppsx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.template": {
    "source": "iana",
    "extensions": ["potx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    "source": "iana",
    "compressible": false,
    "extensions": ["xlsx"]
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
    "source": "iana",
    "extensions": ["xltx"]
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.theme+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.themeoverride+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.vmldrawing": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    "source": "iana",
    "compressible": false,
    "extensions": ["docx"]
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
    "source": "iana",
    "extensions": ["dotx"]
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-package.core-properties+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.openxmlformats-package.relationships+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oracle.resource+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.orange.indata": {
    "source": "iana"
  },
  "application/vnd.osa.netdeploy": {
    "source": "iana"
  },
  "application/vnd.osgeo.mapguide.package": {
    "source": "iana",
    "extensions": ["mgp"]
  },
  "application/vnd.osgi.bundle": {
    "source": "iana"
  },
  "application/vnd.osgi.dp": {
    "source": "iana",
    "extensions": ["dp"]
  },
  "application/vnd.osgi.subsystem": {
    "source": "iana",
    "extensions": ["esa"]
  },
  "application/vnd.otps.ct-kip+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oxli.countgraph": {
    "source": "iana"
  },
  "application/vnd.pagerduty+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.palm": {
    "source": "iana",
    "extensions": ["pdb","pqa","oprc"]
  },
  "application/vnd.panoply": {
    "source": "iana"
  },
  "application/vnd.paos.xml": {
    "source": "iana"
  },
  "application/vnd.patentdive": {
    "source": "iana"
  },
  "application/vnd.patientecommsdoc": {
    "source": "iana"
  },
  "application/vnd.pawaafile": {
    "source": "iana",
    "extensions": ["paw"]
  },
  "application/vnd.pcos": {
    "source": "iana"
  },
  "application/vnd.pg.format": {
    "source": "iana",
    "extensions": ["str"]
  },
  "application/vnd.pg.osasli": {
    "source": "iana",
    "extensions": ["ei6"]
  },
  "application/vnd.piaccess.application-licence": {
    "source": "iana"
  },
  "application/vnd.picsel": {
    "source": "iana",
    "extensions": ["efif"]
  },
  "application/vnd.pmi.widget": {
    "source": "iana",
    "extensions": ["wg"]
  },
  "application/vnd.poc.group-advertisement+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.pocketlearn": {
    "source": "iana",
    "extensions": ["plf"]
  },
  "application/vnd.powerbuilder6": {
    "source": "iana",
    "extensions": ["pbd"]
  },
  "application/vnd.powerbuilder6-s": {
    "source": "iana"
  },
  "application/vnd.powerbuilder7": {
    "source": "iana"
  },
  "application/vnd.powerbuilder7-s": {
    "source": "iana"
  },
  "application/vnd.powerbuilder75": {
    "source": "iana"
  },
  "application/vnd.powerbuilder75-s": {
    "source": "iana"
  },
  "application/vnd.preminet": {
    "source": "iana"
  },
  "application/vnd.previewsystems.box": {
    "source": "iana",
    "extensions": ["box"]
  },
  "application/vnd.proteus.magazine": {
    "source": "iana",
    "extensions": ["mgz"]
  },
  "application/vnd.psfs": {
    "source": "iana"
  },
  "application/vnd.publishare-delta-tree": {
    "source": "iana",
    "extensions": ["qps"]
  },
  "application/vnd.pvi.ptid1": {
    "source": "iana",
    "extensions": ["ptid"]
  },
  "application/vnd.pwg-multiplexed": {
    "source": "iana"
  },
  "application/vnd.pwg-xhtml-print+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.qualcomm.brew-app-res": {
    "source": "iana"
  },
  "application/vnd.quarantainenet": {
    "source": "iana"
  },
  "application/vnd.quark.quarkxpress": {
    "source": "iana",
    "extensions": ["qxd","qxt","qwd","qwt","qxl","qxb"]
  },
  "application/vnd.quobject-quoxdocument": {
    "source": "iana"
  },
  "application/vnd.radisys.moml+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-audit+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-audit-conf+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-audit-conn+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-audit-dialog+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-audit-stream+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-conf+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-dialog+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-dialog-base+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-dialog-fax-detect+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-dialog-group+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-dialog-speech+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.radisys.msml-dialog-transform+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.rainstor.data": {
    "source": "iana"
  },
  "application/vnd.rapid": {
    "source": "iana"
  },
  "application/vnd.rar": {
    "source": "iana",
    "extensions": ["rar"]
  },
  "application/vnd.realvnc.bed": {
    "source": "iana",
    "extensions": ["bed"]
  },
  "application/vnd.recordare.musicxml": {
    "source": "iana",
    "extensions": ["mxl"]
  },
  "application/vnd.recordare.musicxml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["musicxml"]
  },
  "application/vnd.renlearn.rlprint": {
    "source": "iana"
  },
  "application/vnd.resilient.logic": {
    "source": "iana"
  },
  "application/vnd.restful+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.rig.cryptonote": {
    "source": "iana",
    "extensions": ["cryptonote"]
  },
  "application/vnd.rim.cod": {
    "source": "apache",
    "extensions": ["cod"]
  },
  "application/vnd.rn-realmedia": {
    "source": "apache",
    "extensions": ["rm"]
  },
  "application/vnd.rn-realmedia-vbr": {
    "source": "apache",
    "extensions": ["rmvb"]
  },
  "application/vnd.route66.link66+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["link66"]
  },
  "application/vnd.rs-274x": {
    "source": "iana"
  },
  "application/vnd.ruckus.download": {
    "source": "iana"
  },
  "application/vnd.s3sms": {
    "source": "iana"
  },
  "application/vnd.sailingtracker.track": {
    "source": "iana",
    "extensions": ["st"]
  },
  "application/vnd.sar": {
    "source": "iana"
  },
  "application/vnd.sbm.cid": {
    "source": "iana"
  },
  "application/vnd.sbm.mid2": {
    "source": "iana"
  },
  "application/vnd.scribus": {
    "source": "iana"
  },
  "application/vnd.sealed.3df": {
    "source": "iana"
  },
  "application/vnd.sealed.csf": {
    "source": "iana"
  },
  "application/vnd.sealed.doc": {
    "source": "iana"
  },
  "application/vnd.sealed.eml": {
    "source": "iana"
  },
  "application/vnd.sealed.mht": {
    "source": "iana"
  },
  "application/vnd.sealed.net": {
    "source": "iana"
  },
  "application/vnd.sealed.ppt": {
    "source": "iana"
  },
  "application/vnd.sealed.tiff": {
    "source": "iana"
  },
  "application/vnd.sealed.xls": {
    "source": "iana"
  },
  "application/vnd.sealedmedia.softseal.html": {
    "source": "iana"
  },
  "application/vnd.sealedmedia.softseal.pdf": {
    "source": "iana"
  },
  "application/vnd.seemail": {
    "source": "iana",
    "extensions": ["see"]
  },
  "application/vnd.seis+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.sema": {
    "source": "iana",
    "extensions": ["sema"]
  },
  "application/vnd.semd": {
    "source": "iana",
    "extensions": ["semd"]
  },
  "application/vnd.semf": {
    "source": "iana",
    "extensions": ["semf"]
  },
  "application/vnd.shade-save-file": {
    "source": "iana"
  },
  "application/vnd.shana.informed.formdata": {
    "source": "iana",
    "extensions": ["ifm"]
  },
  "application/vnd.shana.informed.formtemplate": {
    "source": "iana",
    "extensions": ["itp"]
  },
  "application/vnd.shana.informed.interchange": {
    "source": "iana",
    "extensions": ["iif"]
  },
  "application/vnd.shana.informed.package": {
    "source": "iana",
    "extensions": ["ipk"]
  },
  "application/vnd.shootproof+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.shopkick+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.shp": {
    "source": "iana"
  },
  "application/vnd.shx": {
    "source": "iana"
  },
  "application/vnd.sigrok.session": {
    "source": "iana"
  },
  "application/vnd.simtech-mindmapper": {
    "source": "iana",
    "extensions": ["twd","twds"]
  },
  "application/vnd.siren+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.smaf": {
    "source": "iana",
    "extensions": ["mmf"]
  },
  "application/vnd.smart.notebook": {
    "source": "iana"
  },
  "application/vnd.smart.teacher": {
    "source": "iana",
    "extensions": ["teacher"]
  },
  "application/vnd.snesdev-page-table": {
    "source": "iana"
  },
  "application/vnd.software602.filler.form+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["fo"]
  },
  "application/vnd.software602.filler.form-xml-zip": {
    "source": "iana"
  },
  "application/vnd.solent.sdkm+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["sdkm","sdkd"]
  },
  "application/vnd.spotfire.dxp": {
    "source": "iana",
    "extensions": ["dxp"]
  },
  "application/vnd.spotfire.sfs": {
    "source": "iana",
    "extensions": ["sfs"]
  },
  "application/vnd.sqlite3": {
    "source": "iana"
  },
  "application/vnd.sss-cod": {
    "source": "iana"
  },
  "application/vnd.sss-dtf": {
    "source": "iana"
  },
  "application/vnd.sss-ntf": {
    "source": "iana"
  },
  "application/vnd.stardivision.calc": {
    "source": "apache",
    "extensions": ["sdc"]
  },
  "application/vnd.stardivision.draw": {
    "source": "apache",
    "extensions": ["sda"]
  },
  "application/vnd.stardivision.impress": {
    "source": "apache",
    "extensions": ["sdd"]
  },
  "application/vnd.stardivision.math": {
    "source": "apache",
    "extensions": ["smf"]
  },
  "application/vnd.stardivision.writer": {
    "source": "apache",
    "extensions": ["sdw","vor"]
  },
  "application/vnd.stardivision.writer-global": {
    "source": "apache",
    "extensions": ["sgl"]
  },
  "application/vnd.stepmania.package": {
    "source": "iana",
    "extensions": ["smzip"]
  },
  "application/vnd.stepmania.stepchart": {
    "source": "iana",
    "extensions": ["sm"]
  },
  "application/vnd.street-stream": {
    "source": "iana"
  },
  "application/vnd.sun.wadl+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["wadl"]
  },
  "application/vnd.sun.xml.calc": {
    "source": "apache",
    "extensions": ["sxc"]
  },
  "application/vnd.sun.xml.calc.template": {
    "source": "apache",
    "extensions": ["stc"]
  },
  "application/vnd.sun.xml.draw": {
    "source": "apache",
    "extensions": ["sxd"]
  },
  "application/vnd.sun.xml.draw.template": {
    "source": "apache",
    "extensions": ["std"]
  },
  "application/vnd.sun.xml.impress": {
    "source": "apache",
    "extensions": ["sxi"]
  },
  "application/vnd.sun.xml.impress.template": {
    "source": "apache",
    "extensions": ["sti"]
  },
  "application/vnd.sun.xml.math": {
    "source": "apache",
    "extensions": ["sxm"]
  },
  "application/vnd.sun.xml.writer": {
    "source": "apache",
    "extensions": ["sxw"]
  },
  "application/vnd.sun.xml.writer.global": {
    "source": "apache",
    "extensions": ["sxg"]
  },
  "application/vnd.sun.xml.writer.template": {
    "source": "apache",
    "extensions": ["stw"]
  },
  "application/vnd.sus-calendar": {
    "source": "iana",
    "extensions": ["sus","susp"]
  },
  "application/vnd.svd": {
    "source": "iana",
    "extensions": ["svd"]
  },
  "application/vnd.swiftview-ics": {
    "source": "iana"
  },
  "application/vnd.sycle+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.syft+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.symbian.install": {
    "source": "apache",
    "extensions": ["sis","sisx"]
  },
  "application/vnd.syncml+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["xsm"]
  },
  "application/vnd.syncml.dm+wbxml": {
    "source": "iana",
    "charset": "UTF-8",
    "extensions": ["bdm"]
  },
  "application/vnd.syncml.dm+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["xdm"]
  },
  "application/vnd.syncml.dm.notification": {
    "source": "iana"
  },
  "application/vnd.syncml.dmddf+wbxml": {
    "source": "iana"
  },
  "application/vnd.syncml.dmddf+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["ddf"]
  },
  "application/vnd.syncml.dmtnds+wbxml": {
    "source": "iana"
  },
  "application/vnd.syncml.dmtnds+xml": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true
  },
  "application/vnd.syncml.ds.notification": {
    "source": "iana"
  },
  "application/vnd.tableschema+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.tao.intent-module-archive": {
    "source": "iana",
    "extensions": ["tao"]
  },
  "application/vnd.tcpdump.pcap": {
    "source": "iana",
    "extensions": ["pcap","cap","dmp"]
  },
  "application/vnd.think-cell.ppttc+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.tmd.mediaflex.api+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.tml": {
    "source": "iana"
  },
  "application/vnd.tmobile-livetv": {
    "source": "iana",
    "extensions": ["tmo"]
  },
  "application/vnd.tri.onesource": {
    "source": "iana"
  },
  "application/vnd.trid.tpt": {
    "source": "iana",
    "extensions": ["tpt"]
  },
  "application/vnd.triscape.mxs": {
    "source": "iana",
    "extensions": ["mxs"]
  },
  "application/vnd.trueapp": {
    "source": "iana",
    "extensions": ["tra"]
  },
  "application/vnd.truedoc": {
    "source": "iana"
  },
  "application/vnd.ubisoft.webplayer": {
    "source": "iana"
  },
  "application/vnd.ufdl": {
    "source": "iana",
    "extensions": ["ufd","ufdl"]
  },
  "application/vnd.uiq.theme": {
    "source": "iana",
    "extensions": ["utz"]
  },
  "application/vnd.umajin": {
    "source": "iana",
    "extensions": ["umj"]
  },
  "application/vnd.unity": {
    "source": "iana",
    "extensions": ["unityweb"]
  },
  "application/vnd.uoml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["uoml"]
  },
  "application/vnd.uplanet.alert": {
    "source": "iana"
  },
  "application/vnd.uplanet.alert-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.bearer-choice": {
    "source": "iana"
  },
  "application/vnd.uplanet.bearer-choice-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.cacheop": {
    "source": "iana"
  },
  "application/vnd.uplanet.cacheop-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.channel": {
    "source": "iana"
  },
  "application/vnd.uplanet.channel-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.list": {
    "source": "iana"
  },
  "application/vnd.uplanet.list-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.listcmd": {
    "source": "iana"
  },
  "application/vnd.uplanet.listcmd-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.signal": {
    "source": "iana"
  },
  "application/vnd.uri-map": {
    "source": "iana"
  },
  "application/vnd.valve.source.material": {
    "source": "iana"
  },
  "application/vnd.vcx": {
    "source": "iana",
    "extensions": ["vcx"]
  },
  "application/vnd.vd-study": {
    "source": "iana"
  },
  "application/vnd.vectorworks": {
    "source": "iana"
  },
  "application/vnd.vel+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.verimatrix.vcas": {
    "source": "iana"
  },
  "application/vnd.veritone.aion+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.veryant.thin": {
    "source": "iana"
  },
  "application/vnd.ves.encrypted": {
    "source": "iana"
  },
  "application/vnd.vidsoft.vidconference": {
    "source": "iana"
  },
  "application/vnd.visio": {
    "source": "iana",
    "extensions": ["vsd","vst","vss","vsw"]
  },
  "application/vnd.visionary": {
    "source": "iana",
    "extensions": ["vis"]
  },
  "application/vnd.vividence.scriptfile": {
    "source": "iana"
  },
  "application/vnd.vsf": {
    "source": "iana",
    "extensions": ["vsf"]
  },
  "application/vnd.wap.sic": {
    "source": "iana"
  },
  "application/vnd.wap.slc": {
    "source": "iana"
  },
  "application/vnd.wap.wbxml": {
    "source": "iana",
    "charset": "UTF-8",
    "extensions": ["wbxml"]
  },
  "application/vnd.wap.wmlc": {
    "source": "iana",
    "extensions": ["wmlc"]
  },
  "application/vnd.wap.wmlscriptc": {
    "source": "iana",
    "extensions": ["wmlsc"]
  },
  "application/vnd.webturbo": {
    "source": "iana",
    "extensions": ["wtb"]
  },
  "application/vnd.wfa.dpp": {
    "source": "iana"
  },
  "application/vnd.wfa.p2p": {
    "source": "iana"
  },
  "application/vnd.wfa.wsc": {
    "source": "iana"
  },
  "application/vnd.windows.devicepairing": {
    "source": "iana"
  },
  "application/vnd.wmc": {
    "source": "iana"
  },
  "application/vnd.wmf.bootstrap": {
    "source": "iana"
  },
  "application/vnd.wolfram.mathematica": {
    "source": "iana"
  },
  "application/vnd.wolfram.mathematica.package": {
    "source": "iana"
  },
  "application/vnd.wolfram.player": {
    "source": "iana",
    "extensions": ["nbp"]
  },
  "application/vnd.wordperfect": {
    "source": "iana",
    "extensions": ["wpd"]
  },
  "application/vnd.wqd": {
    "source": "iana",
    "extensions": ["wqd"]
  },
  "application/vnd.wrq-hp3000-labelled": {
    "source": "iana"
  },
  "application/vnd.wt.stf": {
    "source": "iana",
    "extensions": ["stf"]
  },
  "application/vnd.wv.csp+wbxml": {
    "source": "iana"
  },
  "application/vnd.wv.csp+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.wv.ssp+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.xacml+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.xara": {
    "source": "iana",
    "extensions": ["xar"]
  },
  "application/vnd.xfdl": {
    "source": "iana",
    "extensions": ["xfdl"]
  },
  "application/vnd.xfdl.webform": {
    "source": "iana"
  },
  "application/vnd.xmi+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.xmpie.cpkg": {
    "source": "iana"
  },
  "application/vnd.xmpie.dpkg": {
    "source": "iana"
  },
  "application/vnd.xmpie.plan": {
    "source": "iana"
  },
  "application/vnd.xmpie.ppkg": {
    "source": "iana"
  },
  "application/vnd.xmpie.xlim": {
    "source": "iana"
  },
  "application/vnd.yamaha.hv-dic": {
    "source": "iana",
    "extensions": ["hvd"]
  },
  "application/vnd.yamaha.hv-script": {
    "source": "iana",
    "extensions": ["hvs"]
  },
  "application/vnd.yamaha.hv-voice": {
    "source": "iana",
    "extensions": ["hvp"]
  },
  "application/vnd.yamaha.openscoreformat": {
    "source": "iana",
    "extensions": ["osf"]
  },
  "application/vnd.yamaha.openscoreformat.osfpvg+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["osfpvg"]
  },
  "application/vnd.yamaha.remote-setup": {
    "source": "iana"
  },
  "application/vnd.yamaha.smaf-audio": {
    "source": "iana",
    "extensions": ["saf"]
  },
  "application/vnd.yamaha.smaf-phrase": {
    "source": "iana",
    "extensions": ["spf"]
  },
  "application/vnd.yamaha.through-ngn": {
    "source": "iana"
  },
  "application/vnd.yamaha.tunnel-udpencap": {
    "source": "iana"
  },
  "application/vnd.yaoweme": {
    "source": "iana"
  },
  "application/vnd.yellowriver-custom-menu": {
    "source": "iana",
    "extensions": ["cmp"]
  },
  "application/vnd.youtube.yt": {
    "source": "iana"
  },
  "application/vnd.zul": {
    "source": "iana",
    "extensions": ["zir","zirz"]
  },
  "application/vnd.zzazz.deck+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["zaz"]
  },
  "application/voicexml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["vxml"]
  },
  "application/voucher-cms+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vq-rtcpxr": {
    "source": "iana"
  },
  "application/wasm": {
    "source": "iana",
    "compressible": true,
    "extensions": ["wasm"]
  },
  "application/watcherinfo+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["wif"]
  },
  "application/webpush-options+json": {
    "source": "iana",
    "compressible": true
  },
  "application/whoispp-query": {
    "source": "iana"
  },
  "application/whoispp-response": {
    "source": "iana"
  },
  "application/widget": {
    "source": "iana",
    "extensions": ["wgt"]
  },
  "application/winhlp": {
    "source": "apache",
    "extensions": ["hlp"]
  },
  "application/wita": {
    "source": "iana"
  },
  "application/wordperfect5.1": {
    "source": "iana"
  },
  "application/wsdl+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["wsdl"]
  },
  "application/wspolicy+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["wspolicy"]
  },
  "application/x-7z-compressed": {
    "source": "apache",
    "compressible": false,
    "extensions": ["7z"]
  },
  "application/x-abiword": {
    "source": "apache",
    "extensions": ["abw"]
  },
  "application/x-ace-compressed": {
    "source": "apache",
    "extensions": ["ace"]
  },
  "application/x-amf": {
    "source": "apache"
  },
  "application/x-apple-diskimage": {
    "source": "apache",
    "extensions": ["dmg"]
  },
  "application/x-arj": {
    "compressible": false,
    "extensions": ["arj"]
  },
  "application/x-authorware-bin": {
    "source": "apache",
    "extensions": ["aab","x32","u32","vox"]
  },
  "application/x-authorware-map": {
    "source": "apache",
    "extensions": ["aam"]
  },
  "application/x-authorware-seg": {
    "source": "apache",
    "extensions": ["aas"]
  },
  "application/x-bcpio": {
    "source": "apache",
    "extensions": ["bcpio"]
  },
  "application/x-bdoc": {
    "compressible": false,
    "extensions": ["bdoc"]
  },
  "application/x-bittorrent": {
    "source": "apache",
    "extensions": ["torrent"]
  },
  "application/x-blorb": {
    "source": "apache",
    "extensions": ["blb","blorb"]
  },
  "application/x-bzip": {
    "source": "apache",
    "compressible": false,
    "extensions": ["bz"]
  },
  "application/x-bzip2": {
    "source": "apache",
    "compressible": false,
    "extensions": ["bz2","boz"]
  },
  "application/x-cbr": {
    "source": "apache",
    "extensions": ["cbr","cba","cbt","cbz","cb7"]
  },
  "application/x-cdlink": {
    "source": "apache",
    "extensions": ["vcd"]
  },
  "application/x-cfs-compressed": {
    "source": "apache",
    "extensions": ["cfs"]
  },
  "application/x-chat": {
    "source": "apache",
    "extensions": ["chat"]
  },
  "application/x-chess-pgn": {
    "source": "apache",
    "extensions": ["pgn"]
  },
  "application/x-chrome-extension": {
    "extensions": ["crx"]
  },
  "application/x-cocoa": {
    "source": "nginx",
    "extensions": ["cco"]
  },
  "application/x-compress": {
    "source": "apache"
  },
  "application/x-conference": {
    "source": "apache",
    "extensions": ["nsc"]
  },
  "application/x-cpio": {
    "source": "apache",
    "extensions": ["cpio"]
  },
  "application/x-csh": {
    "source": "apache",
    "extensions": ["csh"]
  },
  "application/x-deb": {
    "compressible": false
  },
  "application/x-debian-package": {
    "source": "apache",
    "extensions": ["deb","udeb"]
  },
  "application/x-dgc-compressed": {
    "source": "apache",
    "extensions": ["dgc"]
  },
  "application/x-director": {
    "source": "apache",
    "extensions": ["dir","dcr","dxr","cst","cct","cxt","w3d","fgd","swa"]
  },
  "application/x-doom": {
    "source": "apache",
    "extensions": ["wad"]
  },
  "application/x-dtbncx+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["ncx"]
  },
  "application/x-dtbook+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["dtb"]
  },
  "application/x-dtbresource+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["res"]
  },
  "application/x-dvi": {
    "source": "apache",
    "compressible": false,
    "extensions": ["dvi"]
  },
  "application/x-envoy": {
    "source": "apache",
    "extensions": ["evy"]
  },
  "application/x-eva": {
    "source": "apache",
    "extensions": ["eva"]
  },
  "application/x-font-bdf": {
    "source": "apache",
    "extensions": ["bdf"]
  },
  "application/x-font-dos": {
    "source": "apache"
  },
  "application/x-font-framemaker": {
    "source": "apache"
  },
  "application/x-font-ghostscript": {
    "source": "apache",
    "extensions": ["gsf"]
  },
  "application/x-font-libgrx": {
    "source": "apache"
  },
  "application/x-font-linux-psf": {
    "source": "apache",
    "extensions": ["psf"]
  },
  "application/x-font-pcf": {
    "source": "apache",
    "extensions": ["pcf"]
  },
  "application/x-font-snf": {
    "source": "apache",
    "extensions": ["snf"]
  },
  "application/x-font-speedo": {
    "source": "apache"
  },
  "application/x-font-sunos-news": {
    "source": "apache"
  },
  "application/x-font-type1": {
    "source": "apache",
    "extensions": ["pfa","pfb","pfm","afm"]
  },
  "application/x-font-vfont": {
    "source": "apache"
  },
  "application/x-freearc": {
    "source": "apache",
    "extensions": ["arc"]
  },
  "application/x-futuresplash": {
    "source": "apache",
    "extensions": ["spl"]
  },
  "application/x-gca-compressed": {
    "source": "apache",
    "extensions": ["gca"]
  },
  "application/x-glulx": {
    "source": "apache",
    "extensions": ["ulx"]
  },
  "application/x-gnumeric": {
    "source": "apache",
    "extensions": ["gnumeric"]
  },
  "application/x-gramps-xml": {
    "source": "apache",
    "extensions": ["gramps"]
  },
  "application/x-gtar": {
    "source": "apache",
    "extensions": ["gtar"]
  },
  "application/x-gzip": {
    "source": "apache"
  },
  "application/x-hdf": {
    "source": "apache",
    "extensions": ["hdf"]
  },
  "application/x-httpd-php": {
    "compressible": true,
    "extensions": ["php"]
  },
  "application/x-install-instructions": {
    "source": "apache",
    "extensions": ["install"]
  },
  "application/x-iso9660-image": {
    "source": "apache",
    "extensions": ["iso"]
  },
  "application/x-iwork-keynote-sffkey": {
    "extensions": ["key"]
  },
  "application/x-iwork-numbers-sffnumbers": {
    "extensions": ["numbers"]
  },
  "application/x-iwork-pages-sffpages": {
    "extensions": ["pages"]
  },
  "application/x-java-archive-diff": {
    "source": "nginx",
    "extensions": ["jardiff"]
  },
  "application/x-java-jnlp-file": {
    "source": "apache",
    "compressible": false,
    "extensions": ["jnlp"]
  },
  "application/x-javascript": {
    "compressible": true
  },
  "application/x-keepass2": {
    "extensions": ["kdbx"]
  },
  "application/x-latex": {
    "source": "apache",
    "compressible": false,
    "extensions": ["latex"]
  },
  "application/x-lua-bytecode": {
    "extensions": ["luac"]
  },
  "application/x-lzh-compressed": {
    "source": "apache",
    "extensions": ["lzh","lha"]
  },
  "application/x-makeself": {
    "source": "nginx",
    "extensions": ["run"]
  },
  "application/x-mie": {
    "source": "apache",
    "extensions": ["mie"]
  },
  "application/x-mobipocket-ebook": {
    "source": "apache",
    "extensions": ["prc","mobi"]
  },
  "application/x-mpegurl": {
    "compressible": false
  },
  "application/x-ms-application": {
    "source": "apache",
    "extensions": ["application"]
  },
  "application/x-ms-shortcut": {
    "source": "apache",
    "extensions": ["lnk"]
  },
  "application/x-ms-wmd": {
    "source": "apache",
    "extensions": ["wmd"]
  },
  "application/x-ms-wmz": {
    "source": "apache",
    "extensions": ["wmz"]
  },
  "application/x-ms-xbap": {
    "source": "apache",
    "extensions": ["xbap"]
  },
  "application/x-msaccess": {
    "source": "apache",
    "extensions": ["mdb"]
  },
  "application/x-msbinder": {
    "source": "apache",
    "extensions": ["obd"]
  },
  "application/x-mscardfile": {
    "source": "apache",
    "extensions": ["crd"]
  },
  "application/x-msclip": {
    "source": "apache",
    "extensions": ["clp"]
  },
  "application/x-msdos-program": {
    "extensions": ["exe"]
  },
  "application/x-msdownload": {
    "source": "apache",
    "extensions": ["exe","dll","com","bat","msi"]
  },
  "application/x-msmediaview": {
    "source": "apache",
    "extensions": ["mvb","m13","m14"]
  },
  "application/x-msmetafile": {
    "source": "apache",
    "extensions": ["wmf","wmz","emf","emz"]
  },
  "application/x-msmoney": {
    "source": "apache",
    "extensions": ["mny"]
  },
  "application/x-mspublisher": {
    "source": "apache",
    "extensions": ["pub"]
  },
  "application/x-msschedule": {
    "source": "apache",
    "extensions": ["scd"]
  },
  "application/x-msterminal": {
    "source": "apache",
    "extensions": ["trm"]
  },
  "application/x-mswrite": {
    "source": "apache",
    "extensions": ["wri"]
  },
  "application/x-netcdf": {
    "source": "apache",
    "extensions": ["nc","cdf"]
  },
  "application/x-ns-proxy-autoconfig": {
    "compressible": true,
    "extensions": ["pac"]
  },
  "application/x-nzb": {
    "source": "apache",
    "extensions": ["nzb"]
  },
  "application/x-perl": {
    "source": "nginx",
    "extensions": ["pl","pm"]
  },
  "application/x-pilot": {
    "source": "nginx",
    "extensions": ["prc","pdb"]
  },
  "application/x-pkcs12": {
    "source": "apache",
    "compressible": false,
    "extensions": ["p12","pfx"]
  },
  "application/x-pkcs7-certificates": {
    "source": "apache",
    "extensions": ["p7b","spc"]
  },
  "application/x-pkcs7-certreqresp": {
    "source": "apache",
    "extensions": ["p7r"]
  },
  "application/x-pki-message": {
    "source": "iana"
  },
  "application/x-rar-compressed": {
    "source": "apache",
    "compressible": false,
    "extensions": ["rar"]
  },
  "application/x-redhat-package-manager": {
    "source": "nginx",
    "extensions": ["rpm"]
  },
  "application/x-research-info-systems": {
    "source": "apache",
    "extensions": ["ris"]
  },
  "application/x-sea": {
    "source": "nginx",
    "extensions": ["sea"]
  },
  "application/x-sh": {
    "source": "apache",
    "compressible": true,
    "extensions": ["sh"]
  },
  "application/x-shar": {
    "source": "apache",
    "extensions": ["shar"]
  },
  "application/x-shockwave-flash": {
    "source": "apache",
    "compressible": false,
    "extensions": ["swf"]
  },
  "application/x-silverlight-app": {
    "source": "apache",
    "extensions": ["xap"]
  },
  "application/x-sql": {
    "source": "apache",
    "extensions": ["sql"]
  },
  "application/x-stuffit": {
    "source": "apache",
    "compressible": false,
    "extensions": ["sit"]
  },
  "application/x-stuffitx": {
    "source": "apache",
    "extensions": ["sitx"]
  },
  "application/x-subrip": {
    "source": "apache",
    "extensions": ["srt"]
  },
  "application/x-sv4cpio": {
    "source": "apache",
    "extensions": ["sv4cpio"]
  },
  "application/x-sv4crc": {
    "source": "apache",
    "extensions": ["sv4crc"]
  },
  "application/x-t3vm-image": {
    "source": "apache",
    "extensions": ["t3"]
  },
  "application/x-tads": {
    "source": "apache",
    "extensions": ["gam"]
  },
  "application/x-tar": {
    "source": "apache",
    "compressible": true,
    "extensions": ["tar"]
  },
  "application/x-tcl": {
    "source": "apache",
    "extensions": ["tcl","tk"]
  },
  "application/x-tex": {
    "source": "apache",
    "extensions": ["tex"]
  },
  "application/x-tex-tfm": {
    "source": "apache",
    "extensions": ["tfm"]
  },
  "application/x-texinfo": {
    "source": "apache",
    "extensions": ["texinfo","texi"]
  },
  "application/x-tgif": {
    "source": "apache",
    "extensions": ["obj"]
  },
  "application/x-ustar": {
    "source": "apache",
    "extensions": ["ustar"]
  },
  "application/x-virtualbox-hdd": {
    "compressible": true,
    "extensions": ["hdd"]
  },
  "application/x-virtualbox-ova": {
    "compressible": true,
    "extensions": ["ova"]
  },
  "application/x-virtualbox-ovf": {
    "compressible": true,
    "extensions": ["ovf"]
  },
  "application/x-virtualbox-vbox": {
    "compressible": true,
    "extensions": ["vbox"]
  },
  "application/x-virtualbox-vbox-extpack": {
    "compressible": false,
    "extensions": ["vbox-extpack"]
  },
  "application/x-virtualbox-vdi": {
    "compressible": true,
    "extensions": ["vdi"]
  },
  "application/x-virtualbox-vhd": {
    "compressible": true,
    "extensions": ["vhd"]
  },
  "application/x-virtualbox-vmdk": {
    "compressible": true,
    "extensions": ["vmdk"]
  },
  "application/x-wais-source": {
    "source": "apache",
    "extensions": ["src"]
  },
  "application/x-web-app-manifest+json": {
    "compressible": true,
    "extensions": ["webapp"]
  },
  "application/x-www-form-urlencoded": {
    "source": "iana",
    "compressible": true
  },
  "application/x-x509-ca-cert": {
    "source": "iana",
    "extensions": ["der","crt","pem"]
  },
  "application/x-x509-ca-ra-cert": {
    "source": "iana"
  },
  "application/x-x509-next-ca-cert": {
    "source": "iana"
  },
  "application/x-xfig": {
    "source": "apache",
    "extensions": ["fig"]
  },
  "application/x-xliff+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["xlf"]
  },
  "application/x-xpinstall": {
    "source": "apache",
    "compressible": false,
    "extensions": ["xpi"]
  },
  "application/x-xz": {
    "source": "apache",
    "extensions": ["xz"]
  },
  "application/x-zmachine": {
    "source": "apache",
    "extensions": ["z1","z2","z3","z4","z5","z6","z7","z8"]
  },
  "application/x400-bp": {
    "source": "iana"
  },
  "application/xacml+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/xaml+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["xaml"]
  },
  "application/xcap-att+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xav"]
  },
  "application/xcap-caps+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xca"]
  },
  "application/xcap-diff+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xdf"]
  },
  "application/xcap-el+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xel"]
  },
  "application/xcap-error+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/xcap-ns+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xns"]
  },
  "application/xcon-conference-info+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/xcon-conference-info-diff+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/xenc+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xenc"]
  },
  "application/xhtml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xhtml","xht"]
  },
  "application/xhtml-voice+xml": {
    "source": "apache",
    "compressible": true
  },
  "application/xliff+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xlf"]
  },
  "application/xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xml","xsl","xsd","rng"]
  },
  "application/xml-dtd": {
    "source": "iana",
    "compressible": true,
    "extensions": ["dtd"]
  },
  "application/xml-external-parsed-entity": {
    "source": "iana"
  },
  "application/xml-patch+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/xmpp+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/xop+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xop"]
  },
  "application/xproc+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["xpl"]
  },
  "application/xslt+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xsl","xslt"]
  },
  "application/xspf+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["xspf"]
  },
  "application/xv+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["mxml","xhvml","xvml","xvm"]
  },
  "application/yang": {
    "source": "iana",
    "extensions": ["yang"]
  },
  "application/yang-data+json": {
    "source": "iana",
    "compressible": true
  },
  "application/yang-data+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/yang-patch+json": {
    "source": "iana",
    "compressible": true
  },
  "application/yang-patch+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/yin+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["yin"]
  },
  "application/zip": {
    "source": "iana",
    "compressible": false,
    "extensions": ["zip"]
  },
  "application/zlib": {
    "source": "iana"
  },
  "application/zstd": {
    "source": "iana"
  },
  "audio/1d-interleaved-parityfec": {
    "source": "iana"
  },
  "audio/32kadpcm": {
    "source": "iana"
  },
  "audio/3gpp": {
    "source": "iana",
    "compressible": false,
    "extensions": ["3gpp"]
  },
  "audio/3gpp2": {
    "source": "iana"
  },
  "audio/aac": {
    "source": "iana"
  },
  "audio/ac3": {
    "source": "iana"
  },
  "audio/adpcm": {
    "source": "apache",
    "extensions": ["adp"]
  },
  "audio/amr": {
    "source": "iana",
    "extensions": ["amr"]
  },
  "audio/amr-wb": {
    "source": "iana"
  },
  "audio/amr-wb+": {
    "source": "iana"
  },
  "audio/aptx": {
    "source": "iana"
  },
  "audio/asc": {
    "source": "iana"
  },
  "audio/atrac-advanced-lossless": {
    "source": "iana"
  },
  "audio/atrac-x": {
    "source": "iana"
  },
  "audio/atrac3": {
    "source": "iana"
  },
  "audio/basic": {
    "source": "iana",
    "compressible": false,
    "extensions": ["au","snd"]
  },
  "audio/bv16": {
    "source": "iana"
  },
  "audio/bv32": {
    "source": "iana"
  },
  "audio/clearmode": {
    "source": "iana"
  },
  "audio/cn": {
    "source": "iana"
  },
  "audio/dat12": {
    "source": "iana"
  },
  "audio/dls": {
    "source": "iana"
  },
  "audio/dsr-es201108": {
    "source": "iana"
  },
  "audio/dsr-es202050": {
    "source": "iana"
  },
  "audio/dsr-es202211": {
    "source": "iana"
  },
  "audio/dsr-es202212": {
    "source": "iana"
  },
  "audio/dv": {
    "source": "iana"
  },
  "audio/dvi4": {
    "source": "iana"
  },
  "audio/eac3": {
    "source": "iana"
  },
  "audio/encaprtp": {
    "source": "iana"
  },
  "audio/evrc": {
    "source": "iana"
  },
  "audio/evrc-qcp": {
    "source": "iana"
  },
  "audio/evrc0": {
    "source": "iana"
  },
  "audio/evrc1": {
    "source": "iana"
  },
  "audio/evrcb": {
    "source": "iana"
  },
  "audio/evrcb0": {
    "source": "iana"
  },
  "audio/evrcb1": {
    "source": "iana"
  },
  "audio/evrcnw": {
    "source": "iana"
  },
  "audio/evrcnw0": {
    "source": "iana"
  },
  "audio/evrcnw1": {
    "source": "iana"
  },
  "audio/evrcwb": {
    "source": "iana"
  },
  "audio/evrcwb0": {
    "source": "iana"
  },
  "audio/evrcwb1": {
    "source": "iana"
  },
  "audio/evs": {
    "source": "iana"
  },
  "audio/flexfec": {
    "source": "iana"
  },
  "audio/fwdred": {
    "source": "iana"
  },
  "audio/g711-0": {
    "source": "iana"
  },
  "audio/g719": {
    "source": "iana"
  },
  "audio/g722": {
    "source": "iana"
  },
  "audio/g7221": {
    "source": "iana"
  },
  "audio/g723": {
    "source": "iana"
  },
  "audio/g726-16": {
    "source": "iana"
  },
  "audio/g726-24": {
    "source": "iana"
  },
  "audio/g726-32": {
    "source": "iana"
  },
  "audio/g726-40": {
    "source": "iana"
  },
  "audio/g728": {
    "source": "iana"
  },
  "audio/g729": {
    "source": "iana"
  },
  "audio/g7291": {
    "source": "iana"
  },
  "audio/g729d": {
    "source": "iana"
  },
  "audio/g729e": {
    "source": "iana"
  },
  "audio/gsm": {
    "source": "iana"
  },
  "audio/gsm-efr": {
    "source": "iana"
  },
  "audio/gsm-hr-08": {
    "source": "iana"
  },
  "audio/ilbc": {
    "source": "iana"
  },
  "audio/ip-mr_v2.5": {
    "source": "iana"
  },
  "audio/isac": {
    "source": "apache"
  },
  "audio/l16": {
    "source": "iana"
  },
  "audio/l20": {
    "source": "iana"
  },
  "audio/l24": {
    "source": "iana",
    "compressible": false
  },
  "audio/l8": {
    "source": "iana"
  },
  "audio/lpc": {
    "source": "iana"
  },
  "audio/melp": {
    "source": "iana"
  },
  "audio/melp1200": {
    "source": "iana"
  },
  "audio/melp2400": {
    "source": "iana"
  },
  "audio/melp600": {
    "source": "iana"
  },
  "audio/mhas": {
    "source": "iana"
  },
  "audio/midi": {
    "source": "apache",
    "extensions": ["mid","midi","kar","rmi"]
  },
  "audio/mobile-xmf": {
    "source": "iana",
    "extensions": ["mxmf"]
  },
  "audio/mp3": {
    "compressible": false,
    "extensions": ["mp3"]
  },
  "audio/mp4": {
    "source": "iana",
    "compressible": false,
    "extensions": ["m4a","mp4a"]
  },
  "audio/mp4a-latm": {
    "source": "iana"
  },
  "audio/mpa": {
    "source": "iana"
  },
  "audio/mpa-robust": {
    "source": "iana"
  },
  "audio/mpeg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["mpga","mp2","mp2a","mp3","m2a","m3a"]
  },
  "audio/mpeg4-generic": {
    "source": "iana"
  },
  "audio/musepack": {
    "source": "apache"
  },
  "audio/ogg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["oga","ogg","spx","opus"]
  },
  "audio/opus": {
    "source": "iana"
  },
  "audio/parityfec": {
    "source": "iana"
  },
  "audio/pcma": {
    "source": "iana"
  },
  "audio/pcma-wb": {
    "source": "iana"
  },
  "audio/pcmu": {
    "source": "iana"
  },
  "audio/pcmu-wb": {
    "source": "iana"
  },
  "audio/prs.sid": {
    "source": "iana"
  },
  "audio/qcelp": {
    "source": "iana"
  },
  "audio/raptorfec": {
    "source": "iana"
  },
  "audio/red": {
    "source": "iana"
  },
  "audio/rtp-enc-aescm128": {
    "source": "iana"
  },
  "audio/rtp-midi": {
    "source": "iana"
  },
  "audio/rtploopback": {
    "source": "iana"
  },
  "audio/rtx": {
    "source": "iana"
  },
  "audio/s3m": {
    "source": "apache",
    "extensions": ["s3m"]
  },
  "audio/scip": {
    "source": "iana"
  },
  "audio/silk": {
    "source": "apache",
    "extensions": ["sil"]
  },
  "audio/smv": {
    "source": "iana"
  },
  "audio/smv-qcp": {
    "source": "iana"
  },
  "audio/smv0": {
    "source": "iana"
  },
  "audio/sofa": {
    "source": "iana"
  },
  "audio/sp-midi": {
    "source": "iana"
  },
  "audio/speex": {
    "source": "iana"
  },
  "audio/t140c": {
    "source": "iana"
  },
  "audio/t38": {
    "source": "iana"
  },
  "audio/telephone-event": {
    "source": "iana"
  },
  "audio/tetra_acelp": {
    "source": "iana"
  },
  "audio/tetra_acelp_bb": {
    "source": "iana"
  },
  "audio/tone": {
    "source": "iana"
  },
  "audio/tsvcis": {
    "source": "iana"
  },
  "audio/uemclip": {
    "source": "iana"
  },
  "audio/ulpfec": {
    "source": "iana"
  },
  "audio/usac": {
    "source": "iana"
  },
  "audio/vdvi": {
    "source": "iana"
  },
  "audio/vmr-wb": {
    "source": "iana"
  },
  "audio/vnd.3gpp.iufp": {
    "source": "iana"
  },
  "audio/vnd.4sb": {
    "source": "iana"
  },
  "audio/vnd.audiokoz": {
    "source": "iana"
  },
  "audio/vnd.celp": {
    "source": "iana"
  },
  "audio/vnd.cisco.nse": {
    "source": "iana"
  },
  "audio/vnd.cmles.radio-events": {
    "source": "iana"
  },
  "audio/vnd.cns.anp1": {
    "source": "iana"
  },
  "audio/vnd.cns.inf1": {
    "source": "iana"
  },
  "audio/vnd.dece.audio": {
    "source": "iana",
    "extensions": ["uva","uvva"]
  },
  "audio/vnd.digital-winds": {
    "source": "iana",
    "extensions": ["eol"]
  },
  "audio/vnd.dlna.adts": {
    "source": "iana"
  },
  "audio/vnd.dolby.heaac.1": {
    "source": "iana"
  },
  "audio/vnd.dolby.heaac.2": {
    "source": "iana"
  },
  "audio/vnd.dolby.mlp": {
    "source": "iana"
  },
  "audio/vnd.dolby.mps": {
    "source": "iana"
  },
  "audio/vnd.dolby.pl2": {
    "source": "iana"
  },
  "audio/vnd.dolby.pl2x": {
    "source": "iana"
  },
  "audio/vnd.dolby.pl2z": {
    "source": "iana"
  },
  "audio/vnd.dolby.pulse.1": {
    "source": "iana"
  },
  "audio/vnd.dra": {
    "source": "iana",
    "extensions": ["dra"]
  },
  "audio/vnd.dts": {
    "source": "iana",
    "extensions": ["dts"]
  },
  "audio/vnd.dts.hd": {
    "source": "iana",
    "extensions": ["dtshd"]
  },
  "audio/vnd.dts.uhd": {
    "source": "iana"
  },
  "audio/vnd.dvb.file": {
    "source": "iana"
  },
  "audio/vnd.everad.plj": {
    "source": "iana"
  },
  "audio/vnd.hns.audio": {
    "source": "iana"
  },
  "audio/vnd.lucent.voice": {
    "source": "iana",
    "extensions": ["lvp"]
  },
  "audio/vnd.ms-playready.media.pya": {
    "source": "iana",
    "extensions": ["pya"]
  },
  "audio/vnd.nokia.mobile-xmf": {
    "source": "iana"
  },
  "audio/vnd.nortel.vbk": {
    "source": "iana"
  },
  "audio/vnd.nuera.ecelp4800": {
    "source": "iana",
    "extensions": ["ecelp4800"]
  },
  "audio/vnd.nuera.ecelp7470": {
    "source": "iana",
    "extensions": ["ecelp7470"]
  },
  "audio/vnd.nuera.ecelp9600": {
    "source": "iana",
    "extensions": ["ecelp9600"]
  },
  "audio/vnd.octel.sbc": {
    "source": "iana"
  },
  "audio/vnd.presonus.multitrack": {
    "source": "iana"
  },
  "audio/vnd.qcelp": {
    "source": "iana"
  },
  "audio/vnd.rhetorex.32kadpcm": {
    "source": "iana"
  },
  "audio/vnd.rip": {
    "source": "iana",
    "extensions": ["rip"]
  },
  "audio/vnd.rn-realaudio": {
    "compressible": false
  },
  "audio/vnd.sealedmedia.softseal.mpeg": {
    "source": "iana"
  },
  "audio/vnd.vmx.cvsd": {
    "source": "iana"
  },
  "audio/vnd.wave": {
    "compressible": false
  },
  "audio/vorbis": {
    "source": "iana",
    "compressible": false
  },
  "audio/vorbis-config": {
    "source": "iana"
  },
  "audio/wav": {
    "compressible": false,
    "extensions": ["wav"]
  },
  "audio/wave": {
    "compressible": false,
    "extensions": ["wav"]
  },
  "audio/webm": {
    "source": "apache",
    "compressible": false,
    "extensions": ["weba"]
  },
  "audio/x-aac": {
    "source": "apache",
    "compressible": false,
    "extensions": ["aac"]
  },
  "audio/x-aiff": {
    "source": "apache",
    "extensions": ["aif","aiff","aifc"]
  },
  "audio/x-caf": {
    "source": "apache",
    "compressible": false,
    "extensions": ["caf"]
  },
  "audio/x-flac": {
    "source": "apache",
    "extensions": ["flac"]
  },
  "audio/x-m4a": {
    "source": "nginx",
    "extensions": ["m4a"]
  },
  "audio/x-matroska": {
    "source": "apache",
    "extensions": ["mka"]
  },
  "audio/x-mpegurl": {
    "source": "apache",
    "extensions": ["m3u"]
  },
  "audio/x-ms-wax": {
    "source": "apache",
    "extensions": ["wax"]
  },
  "audio/x-ms-wma": {
    "source": "apache",
    "extensions": ["wma"]
  },
  "audio/x-pn-realaudio": {
    "source": "apache",
    "extensions": ["ram","ra"]
  },
  "audio/x-pn-realaudio-plugin": {
    "source": "apache",
    "extensions": ["rmp"]
  },
  "audio/x-realaudio": {
    "source": "nginx",
    "extensions": ["ra"]
  },
  "audio/x-tta": {
    "source": "apache"
  },
  "audio/x-wav": {
    "source": "apache",
    "extensions": ["wav"]
  },
  "audio/xm": {
    "source": "apache",
    "extensions": ["xm"]
  },
  "chemical/x-cdx": {
    "source": "apache",
    "extensions": ["cdx"]
  },
  "chemical/x-cif": {
    "source": "apache",
    "extensions": ["cif"]
  },
  "chemical/x-cmdf": {
    "source": "apache",
    "extensions": ["cmdf"]
  },
  "chemical/x-cml": {
    "source": "apache",
    "extensions": ["cml"]
  },
  "chemical/x-csml": {
    "source": "apache",
    "extensions": ["csml"]
  },
  "chemical/x-pdb": {
    "source": "apache"
  },
  "chemical/x-xyz": {
    "source": "apache",
    "extensions": ["xyz"]
  },
  "font/collection": {
    "source": "iana",
    "extensions": ["ttc"]
  },
  "font/otf": {
    "source": "iana",
    "compressible": true,
    "extensions": ["otf"]
  },
  "font/sfnt": {
    "source": "iana"
  },
  "font/ttf": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ttf"]
  },
  "font/woff": {
    "source": "iana",
    "extensions": ["woff"]
  },
  "font/woff2": {
    "source": "iana",
    "extensions": ["woff2"]
  },
  "image/aces": {
    "source": "iana",
    "extensions": ["exr"]
  },
  "image/apng": {
    "compressible": false,
    "extensions": ["apng"]
  },
  "image/avci": {
    "source": "iana",
    "extensions": ["avci"]
  },
  "image/avcs": {
    "source": "iana",
    "extensions": ["avcs"]
  },
  "image/avif": {
    "source": "iana",
    "compressible": false,
    "extensions": ["avif"]
  },
  "image/bmp": {
    "source": "iana",
    "compressible": true,
    "extensions": ["bmp"]
  },
  "image/cgm": {
    "source": "iana",
    "extensions": ["cgm"]
  },
  "image/dicom-rle": {
    "source": "iana",
    "extensions": ["drle"]
  },
  "image/emf": {
    "source": "iana",
    "extensions": ["emf"]
  },
  "image/fits": {
    "source": "iana",
    "extensions": ["fits"]
  },
  "image/g3fax": {
    "source": "iana",
    "extensions": ["g3"]
  },
  "image/gif": {
    "source": "iana",
    "compressible": false,
    "extensions": ["gif"]
  },
  "image/heic": {
    "source": "iana",
    "extensions": ["heic"]
  },
  "image/heic-sequence": {
    "source": "iana",
    "extensions": ["heics"]
  },
  "image/heif": {
    "source": "iana",
    "extensions": ["heif"]
  },
  "image/heif-sequence": {
    "source": "iana",
    "extensions": ["heifs"]
  },
  "image/hej2k": {
    "source": "iana",
    "extensions": ["hej2"]
  },
  "image/hsj2": {
    "source": "iana",
    "extensions": ["hsj2"]
  },
  "image/ief": {
    "source": "iana",
    "extensions": ["ief"]
  },
  "image/jls": {
    "source": "iana",
    "extensions": ["jls"]
  },
  "image/jp2": {
    "source": "iana",
    "compressible": false,
    "extensions": ["jp2","jpg2"]
  },
  "image/jpeg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["jpeg","jpg","jpe"]
  },
  "image/jph": {
    "source": "iana",
    "extensions": ["jph"]
  },
  "image/jphc": {
    "source": "iana",
    "extensions": ["jhc"]
  },
  "image/jpm": {
    "source": "iana",
    "compressible": false,
    "extensions": ["jpm"]
  },
  "image/jpx": {
    "source": "iana",
    "compressible": false,
    "extensions": ["jpx","jpf"]
  },
  "image/jxr": {
    "source": "iana",
    "extensions": ["jxr"]
  },
  "image/jxra": {
    "source": "iana",
    "extensions": ["jxra"]
  },
  "image/jxrs": {
    "source": "iana",
    "extensions": ["jxrs"]
  },
  "image/jxs": {
    "source": "iana",
    "extensions": ["jxs"]
  },
  "image/jxsc": {
    "source": "iana",
    "extensions": ["jxsc"]
  },
  "image/jxsi": {
    "source": "iana",
    "extensions": ["jxsi"]
  },
  "image/jxss": {
    "source": "iana",
    "extensions": ["jxss"]
  },
  "image/ktx": {
    "source": "iana",
    "extensions": ["ktx"]
  },
  "image/ktx2": {
    "source": "iana",
    "extensions": ["ktx2"]
  },
  "image/naplps": {
    "source": "iana"
  },
  "image/pjpeg": {
    "compressible": false
  },
  "image/png": {
    "source": "iana",
    "compressible": false,
    "extensions": ["png"]
  },
  "image/prs.btif": {
    "source": "iana",
    "extensions": ["btif"]
  },
  "image/prs.pti": {
    "source": "iana",
    "extensions": ["pti"]
  },
  "image/pwg-raster": {
    "source": "iana"
  },
  "image/sgi": {
    "source": "apache",
    "extensions": ["sgi"]
  },
  "image/svg+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["svg","svgz"]
  },
  "image/t38": {
    "source": "iana",
    "extensions": ["t38"]
  },
  "image/tiff": {
    "source": "iana",
    "compressible": false,
    "extensions": ["tif","tiff"]
  },
  "image/tiff-fx": {
    "source": "iana",
    "extensions": ["tfx"]
  },
  "image/vnd.adobe.photoshop": {
    "source": "iana",
    "compressible": true,
    "extensions": ["psd"]
  },
  "image/vnd.airzip.accelerator.azv": {
    "source": "iana",
    "extensions": ["azv"]
  },
  "image/vnd.cns.inf2": {
    "source": "iana"
  },
  "image/vnd.dece.graphic": {
    "source": "iana",
    "extensions": ["uvi","uvvi","uvg","uvvg"]
  },
  "image/vnd.djvu": {
    "source": "iana",
    "extensions": ["djvu","djv"]
  },
  "image/vnd.dvb.subtitle": {
    "source": "iana",
    "extensions": ["sub"]
  },
  "image/vnd.dwg": {
    "source": "iana",
    "extensions": ["dwg"]
  },
  "image/vnd.dxf": {
    "source": "iana",
    "extensions": ["dxf"]
  },
  "image/vnd.fastbidsheet": {
    "source": "iana",
    "extensions": ["fbs"]
  },
  "image/vnd.fpx": {
    "source": "iana",
    "extensions": ["fpx"]
  },
  "image/vnd.fst": {
    "source": "iana",
    "extensions": ["fst"]
  },
  "image/vnd.fujixerox.edmics-mmr": {
    "source": "iana",
    "extensions": ["mmr"]
  },
  "image/vnd.fujixerox.edmics-rlc": {
    "source": "iana",
    "extensions": ["rlc"]
  },
  "image/vnd.globalgraphics.pgb": {
    "source": "iana"
  },
  "image/vnd.microsoft.icon": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ico"]
  },
  "image/vnd.mix": {
    "source": "iana"
  },
  "image/vnd.mozilla.apng": {
    "source": "iana"
  },
  "image/vnd.ms-dds": {
    "compressible": true,
    "extensions": ["dds"]
  },
  "image/vnd.ms-modi": {
    "source": "iana",
    "extensions": ["mdi"]
  },
  "image/vnd.ms-photo": {
    "source": "apache",
    "extensions": ["wdp"]
  },
  "image/vnd.net-fpx": {
    "source": "iana",
    "extensions": ["npx"]
  },
  "image/vnd.pco.b16": {
    "source": "iana",
    "extensions": ["b16"]
  },
  "image/vnd.radiance": {
    "source": "iana"
  },
  "image/vnd.sealed.png": {
    "source": "iana"
  },
  "image/vnd.sealedmedia.softseal.gif": {
    "source": "iana"
  },
  "image/vnd.sealedmedia.softseal.jpg": {
    "source": "iana"
  },
  "image/vnd.svf": {
    "source": "iana"
  },
  "image/vnd.tencent.tap": {
    "source": "iana",
    "extensions": ["tap"]
  },
  "image/vnd.valve.source.texture": {
    "source": "iana",
    "extensions": ["vtf"]
  },
  "image/vnd.wap.wbmp": {
    "source": "iana",
    "extensions": ["wbmp"]
  },
  "image/vnd.xiff": {
    "source": "iana",
    "extensions": ["xif"]
  },
  "image/vnd.zbrush.pcx": {
    "source": "iana",
    "extensions": ["pcx"]
  },
  "image/webp": {
    "source": "apache",
    "extensions": ["webp"]
  },
  "image/wmf": {
    "source": "iana",
    "extensions": ["wmf"]
  },
  "image/x-3ds": {
    "source": "apache",
    "extensions": ["3ds"]
  },
  "image/x-cmu-raster": {
    "source": "apache",
    "extensions": ["ras"]
  },
  "image/x-cmx": {
    "source": "apache",
    "extensions": ["cmx"]
  },
  "image/x-freehand": {
    "source": "apache",
    "extensions": ["fh","fhc","fh4","fh5","fh7"]
  },
  "image/x-icon": {
    "source": "apache",
    "compressible": true,
    "extensions": ["ico"]
  },
  "image/x-jng": {
    "source": "nginx",
    "extensions": ["jng"]
  },
  "image/x-mrsid-image": {
    "source": "apache",
    "extensions": ["sid"]
  },
  "image/x-ms-bmp": {
    "source": "nginx",
    "compressible": true,
    "extensions": ["bmp"]
  },
  "image/x-pcx": {
    "source": "apache",
    "extensions": ["pcx"]
  },
  "image/x-pict": {
    "source": "apache",
    "extensions": ["pic","pct"]
  },
  "image/x-portable-anymap": {
    "source": "apache",
    "extensions": ["pnm"]
  },
  "image/x-portable-bitmap": {
    "source": "apache",
    "extensions": ["pbm"]
  },
  "image/x-portable-graymap": {
    "source": "apache",
    "extensions": ["pgm"]
  },
  "image/x-portable-pixmap": {
    "source": "apache",
    "extensions": ["ppm"]
  },
  "image/x-rgb": {
    "source": "apache",
    "extensions": ["rgb"]
  },
  "image/x-tga": {
    "source": "apache",
    "extensions": ["tga"]
  },
  "image/x-xbitmap": {
    "source": "apache",
    "extensions": ["xbm"]
  },
  "image/x-xcf": {
    "compressible": false
  },
  "image/x-xpixmap": {
    "source": "apache",
    "extensions": ["xpm"]
  },
  "image/x-xwindowdump": {
    "source": "apache",
    "extensions": ["xwd"]
  },
  "message/cpim": {
    "source": "iana"
  },
  "message/delivery-status": {
    "source": "iana"
  },
  "message/disposition-notification": {
    "source": "iana",
    "extensions": [
      "disposition-notification"
    ]
  },
  "message/external-body": {
    "source": "iana"
  },
  "message/feedback-report": {
    "source": "iana"
  },
  "message/global": {
    "source": "iana",
    "extensions": ["u8msg"]
  },
  "message/global-delivery-status": {
    "source": "iana",
    "extensions": ["u8dsn"]
  },
  "message/global-disposition-notification": {
    "source": "iana",
    "extensions": ["u8mdn"]
  },
  "message/global-headers": {
    "source": "iana",
    "extensions": ["u8hdr"]
  },
  "message/http": {
    "source": "iana",
    "compressible": false
  },
  "message/imdn+xml": {
    "source": "iana",
    "compressible": true
  },
  "message/news": {
    "source": "iana"
  },
  "message/partial": {
    "source": "iana",
    "compressible": false
  },
  "message/rfc822": {
    "source": "iana",
    "compressible": true,
    "extensions": ["eml","mime"]
  },
  "message/s-http": {
    "source": "iana"
  },
  "message/sip": {
    "source": "iana"
  },
  "message/sipfrag": {
    "source": "iana"
  },
  "message/tracking-status": {
    "source": "iana"
  },
  "message/vnd.si.simp": {
    "source": "iana"
  },
  "message/vnd.wfa.wsc": {
    "source": "iana",
    "extensions": ["wsc"]
  },
  "model/3mf": {
    "source": "iana",
    "extensions": ["3mf"]
  },
  "model/e57": {
    "source": "iana"
  },
  "model/gltf+json": {
    "source": "iana",
    "compressible": true,
    "extensions": ["gltf"]
  },
  "model/gltf-binary": {
    "source": "iana",
    "compressible": true,
    "extensions": ["glb"]
  },
  "model/iges": {
    "source": "iana",
    "compressible": false,
    "extensions": ["igs","iges"]
  },
  "model/mesh": {
    "source": "iana",
    "compressible": false,
    "extensions": ["msh","mesh","silo"]
  },
  "model/mtl": {
    "source": "iana",
    "extensions": ["mtl"]
  },
  "model/obj": {
    "source": "iana",
    "extensions": ["obj"]
  },
  "model/step": {
    "source": "iana"
  },
  "model/step+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["stpx"]
  },
  "model/step+zip": {
    "source": "iana",
    "compressible": false,
    "extensions": ["stpz"]
  },
  "model/step-xml+zip": {
    "source": "iana",
    "compressible": false,
    "extensions": ["stpxz"]
  },
  "model/stl": {
    "source": "iana",
    "extensions": ["stl"]
  },
  "model/vnd.collada+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["dae"]
  },
  "model/vnd.dwf": {
    "source": "iana",
    "extensions": ["dwf"]
  },
  "model/vnd.flatland.3dml": {
    "source": "iana"
  },
  "model/vnd.gdl": {
    "source": "iana",
    "extensions": ["gdl"]
  },
  "model/vnd.gs-gdl": {
    "source": "apache"
  },
  "model/vnd.gs.gdl": {
    "source": "iana"
  },
  "model/vnd.gtw": {
    "source": "iana",
    "extensions": ["gtw"]
  },
  "model/vnd.moml+xml": {
    "source": "iana",
    "compressible": true
  },
  "model/vnd.mts": {
    "source": "iana",
    "extensions": ["mts"]
  },
  "model/vnd.opengex": {
    "source": "iana",
    "extensions": ["ogex"]
  },
  "model/vnd.parasolid.transmit.binary": {
    "source": "iana",
    "extensions": ["x_b"]
  },
  "model/vnd.parasolid.transmit.text": {
    "source": "iana",
    "extensions": ["x_t"]
  },
  "model/vnd.pytha.pyox": {
    "source": "iana"
  },
  "model/vnd.rosette.annotated-data-model": {
    "source": "iana"
  },
  "model/vnd.sap.vds": {
    "source": "iana",
    "extensions": ["vds"]
  },
  "model/vnd.usdz+zip": {
    "source": "iana",
    "compressible": false,
    "extensions": ["usdz"]
  },
  "model/vnd.valve.source.compiled-map": {
    "source": "iana",
    "extensions": ["bsp"]
  },
  "model/vnd.vtu": {
    "source": "iana",
    "extensions": ["vtu"]
  },
  "model/vrml": {
    "source": "iana",
    "compressible": false,
    "extensions": ["wrl","vrml"]
  },
  "model/x3d+binary": {
    "source": "apache",
    "compressible": false,
    "extensions": ["x3db","x3dbz"]
  },
  "model/x3d+fastinfoset": {
    "source": "iana",
    "extensions": ["x3db"]
  },
  "model/x3d+vrml": {
    "source": "apache",
    "compressible": false,
    "extensions": ["x3dv","x3dvz"]
  },
  "model/x3d+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["x3d","x3dz"]
  },
  "model/x3d-vrml": {
    "source": "iana",
    "extensions": ["x3dv"]
  },
  "multipart/alternative": {
    "source": "iana",
    "compressible": false
  },
  "multipart/appledouble": {
    "source": "iana"
  },
  "multipart/byteranges": {
    "source": "iana"
  },
  "multipart/digest": {
    "source": "iana"
  },
  "multipart/encrypted": {
    "source": "iana",
    "compressible": false
  },
  "multipart/form-data": {
    "source": "iana",
    "compressible": false
  },
  "multipart/header-set": {
    "source": "iana"
  },
  "multipart/mixed": {
    "source": "iana"
  },
  "multipart/multilingual": {
    "source": "iana"
  },
  "multipart/parallel": {
    "source": "iana"
  },
  "multipart/related": {
    "source": "iana",
    "compressible": false
  },
  "multipart/report": {
    "source": "iana"
  },
  "multipart/signed": {
    "source": "iana",
    "compressible": false
  },
  "multipart/vnd.bint.med-plus": {
    "source": "iana"
  },
  "multipart/voice-message": {
    "source": "iana"
  },
  "multipart/x-mixed-replace": {
    "source": "iana"
  },
  "text/1d-interleaved-parityfec": {
    "source": "iana"
  },
  "text/cache-manifest": {
    "source": "iana",
    "compressible": true,
    "extensions": ["appcache","manifest"]
  },
  "text/calendar": {
    "source": "iana",
    "extensions": ["ics","ifb"]
  },
  "text/calender": {
    "compressible": true
  },
  "text/cmd": {
    "compressible": true
  },
  "text/coffeescript": {
    "extensions": ["coffee","litcoffee"]
  },
  "text/cql": {
    "source": "iana"
  },
  "text/cql-expression": {
    "source": "iana"
  },
  "text/cql-identifier": {
    "source": "iana"
  },
  "text/css": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["css"]
  },
  "text/csv": {
    "source": "iana",
    "compressible": true,
    "extensions": ["csv"]
  },
  "text/csv-schema": {
    "source": "iana"
  },
  "text/directory": {
    "source": "iana"
  },
  "text/dns": {
    "source": "iana"
  },
  "text/ecmascript": {
    "source": "iana"
  },
  "text/encaprtp": {
    "source": "iana"
  },
  "text/enriched": {
    "source": "iana"
  },
  "text/fhirpath": {
    "source": "iana"
  },
  "text/flexfec": {
    "source": "iana"
  },
  "text/fwdred": {
    "source": "iana"
  },
  "text/gff3": {
    "source": "iana"
  },
  "text/grammar-ref-list": {
    "source": "iana"
  },
  "text/html": {
    "source": "iana",
    "compressible": true,
    "extensions": ["html","htm","shtml"]
  },
  "text/jade": {
    "extensions": ["jade"]
  },
  "text/javascript": {
    "source": "iana",
    "compressible": true
  },
  "text/jcr-cnd": {
    "source": "iana"
  },
  "text/jsx": {
    "compressible": true,
    "extensions": ["jsx"]
  },
  "text/less": {
    "compressible": true,
    "extensions": ["less"]
  },
  "text/markdown": {
    "source": "iana",
    "compressible": true,
    "extensions": ["markdown","md"]
  },
  "text/mathml": {
    "source": "nginx",
    "extensions": ["mml"]
  },
  "text/mdx": {
    "compressible": true,
    "extensions": ["mdx"]
  },
  "text/mizar": {
    "source": "iana"
  },
  "text/n3": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["n3"]
  },
  "text/parameters": {
    "source": "iana",
    "charset": "UTF-8"
  },
  "text/parityfec": {
    "source": "iana"
  },
  "text/plain": {
    "source": "iana",
    "compressible": true,
    "extensions": ["txt","text","conf","def","list","log","in","ini"]
  },
  "text/provenance-notation": {
    "source": "iana",
    "charset": "UTF-8"
  },
  "text/prs.fallenstein.rst": {
    "source": "iana"
  },
  "text/prs.lines.tag": {
    "source": "iana",
    "extensions": ["dsc"]
  },
  "text/prs.prop.logic": {
    "source": "iana"
  },
  "text/raptorfec": {
    "source": "iana"
  },
  "text/red": {
    "source": "iana"
  },
  "text/rfc822-headers": {
    "source": "iana"
  },
  "text/richtext": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rtx"]
  },
  "text/rtf": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rtf"]
  },
  "text/rtp-enc-aescm128": {
    "source": "iana"
  },
  "text/rtploopback": {
    "source": "iana"
  },
  "text/rtx": {
    "source": "iana"
  },
  "text/sgml": {
    "source": "iana",
    "extensions": ["sgml","sgm"]
  },
  "text/shaclc": {
    "source": "iana"
  },
  "text/shex": {
    "source": "iana",
    "extensions": ["shex"]
  },
  "text/slim": {
    "extensions": ["slim","slm"]
  },
  "text/spdx": {
    "source": "iana",
    "extensions": ["spdx"]
  },
  "text/strings": {
    "source": "iana"
  },
  "text/stylus": {
    "extensions": ["stylus","styl"]
  },
  "text/t140": {
    "source": "iana"
  },
  "text/tab-separated-values": {
    "source": "iana",
    "compressible": true,
    "extensions": ["tsv"]
  },
  "text/troff": {
    "source": "iana",
    "extensions": ["t","tr","roff","man","me","ms"]
  },
  "text/turtle": {
    "source": "iana",
    "charset": "UTF-8",
    "extensions": ["ttl"]
  },
  "text/ulpfec": {
    "source": "iana"
  },
  "text/uri-list": {
    "source": "iana",
    "compressible": true,
    "extensions": ["uri","uris","urls"]
  },
  "text/vcard": {
    "source": "iana",
    "compressible": true,
    "extensions": ["vcard"]
  },
  "text/vnd.a": {
    "source": "iana"
  },
  "text/vnd.abc": {
    "source": "iana"
  },
  "text/vnd.ascii-art": {
    "source": "iana"
  },
  "text/vnd.curl": {
    "source": "iana",
    "extensions": ["curl"]
  },
  "text/vnd.curl.dcurl": {
    "source": "apache",
    "extensions": ["dcurl"]
  },
  "text/vnd.curl.mcurl": {
    "source": "apache",
    "extensions": ["mcurl"]
  },
  "text/vnd.curl.scurl": {
    "source": "apache",
    "extensions": ["scurl"]
  },
  "text/vnd.debian.copyright": {
    "source": "iana",
    "charset": "UTF-8"
  },
  "text/vnd.dmclientscript": {
    "source": "iana"
  },
  "text/vnd.dvb.subtitle": {
    "source": "iana",
    "extensions": ["sub"]
  },
  "text/vnd.esmertec.theme-descriptor": {
    "source": "iana",
    "charset": "UTF-8"
  },
  "text/vnd.familysearch.gedcom": {
    "source": "iana",
    "extensions": ["ged"]
  },
  "text/vnd.ficlab.flt": {
    "source": "iana"
  },
  "text/vnd.fly": {
    "source": "iana",
    "extensions": ["fly"]
  },
  "text/vnd.fmi.flexstor": {
    "source": "iana",
    "extensions": ["flx"]
  },
  "text/vnd.gml": {
    "source": "iana"
  },
  "text/vnd.graphviz": {
    "source": "iana",
    "extensions": ["gv"]
  },
  "text/vnd.hans": {
    "source": "iana"
  },
  "text/vnd.hgl": {
    "source": "iana"
  },
  "text/vnd.in3d.3dml": {
    "source": "iana",
    "extensions": ["3dml"]
  },
  "text/vnd.in3d.spot": {
    "source": "iana",
    "extensions": ["spot"]
  },
  "text/vnd.iptc.newsml": {
    "source": "iana"
  },
  "text/vnd.iptc.nitf": {
    "source": "iana"
  },
  "text/vnd.latex-z": {
    "source": "iana"
  },
  "text/vnd.motorola.reflex": {
    "source": "iana"
  },
  "text/vnd.ms-mediapackage": {
    "source": "iana"
  },
  "text/vnd.net2phone.commcenter.command": {
    "source": "iana"
  },
  "text/vnd.radisys.msml-basic-layout": {
    "source": "iana"
  },
  "text/vnd.senx.warpscript": {
    "source": "iana"
  },
  "text/vnd.si.uricatalogue": {
    "source": "iana"
  },
  "text/vnd.sosi": {
    "source": "iana"
  },
  "text/vnd.sun.j2me.app-descriptor": {
    "source": "iana",
    "charset": "UTF-8",
    "extensions": ["jad"]
  },
  "text/vnd.trolltech.linguist": {
    "source": "iana",
    "charset": "UTF-8"
  },
  "text/vnd.wap.si": {
    "source": "iana"
  },
  "text/vnd.wap.sl": {
    "source": "iana"
  },
  "text/vnd.wap.wml": {
    "source": "iana",
    "extensions": ["wml"]
  },
  "text/vnd.wap.wmlscript": {
    "source": "iana",
    "extensions": ["wmls"]
  },
  "text/vtt": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["vtt"]
  },
  "text/x-asm": {
    "source": "apache",
    "extensions": ["s","asm"]
  },
  "text/x-c": {
    "source": "apache",
    "extensions": ["c","cc","cxx","cpp","h","hh","dic"]
  },
  "text/x-component": {
    "source": "nginx",
    "extensions": ["htc"]
  },
  "text/x-fortran": {
    "source": "apache",
    "extensions": ["f","for","f77","f90"]
  },
  "text/x-gwt-rpc": {
    "compressible": true
  },
  "text/x-handlebars-template": {
    "extensions": ["hbs"]
  },
  "text/x-java-source": {
    "source": "apache",
    "extensions": ["java"]
  },
  "text/x-jquery-tmpl": {
    "compressible": true
  },
  "text/x-lua": {
    "extensions": ["lua"]
  },
  "text/x-markdown": {
    "compressible": true,
    "extensions": ["mkd"]
  },
  "text/x-nfo": {
    "source": "apache",
    "extensions": ["nfo"]
  },
  "text/x-opml": {
    "source": "apache",
    "extensions": ["opml"]
  },
  "text/x-org": {
    "compressible": true,
    "extensions": ["org"]
  },
  "text/x-pascal": {
    "source": "apache",
    "extensions": ["p","pas"]
  },
  "text/x-processing": {
    "compressible": true,
    "extensions": ["pde"]
  },
  "text/x-sass": {
    "extensions": ["sass"]
  },
  "text/x-scss": {
    "extensions": ["scss"]
  },
  "text/x-setext": {
    "source": "apache",
    "extensions": ["etx"]
  },
  "text/x-sfv": {
    "source": "apache",
    "extensions": ["sfv"]
  },
  "text/x-suse-ymp": {
    "compressible": true,
    "extensions": ["ymp"]
  },
  "text/x-uuencode": {
    "source": "apache",
    "extensions": ["uu"]
  },
  "text/x-vcalendar": {
    "source": "apache",
    "extensions": ["vcs"]
  },
  "text/x-vcard": {
    "source": "apache",
    "extensions": ["vcf"]
  },
  "text/xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xml"]
  },
  "text/xml-external-parsed-entity": {
    "source": "iana"
  },
  "text/yaml": {
    "compressible": true,
    "extensions": ["yaml","yml"]
  },
  "video/1d-interleaved-parityfec": {
    "source": "iana"
  },
  "video/3gpp": {
    "source": "iana",
    "extensions": ["3gp","3gpp"]
  },
  "video/3gpp-tt": {
    "source": "iana"
  },
  "video/3gpp2": {
    "source": "iana",
    "extensions": ["3g2"]
  },
  "video/av1": {
    "source": "iana"
  },
  "video/bmpeg": {
    "source": "iana"
  },
  "video/bt656": {
    "source": "iana"
  },
  "video/celb": {
    "source": "iana"
  },
  "video/dv": {
    "source": "iana"
  },
  "video/encaprtp": {
    "source": "iana"
  },
  "video/ffv1": {
    "source": "iana"
  },
  "video/flexfec": {
    "source": "iana"
  },
  "video/h261": {
    "source": "iana",
    "extensions": ["h261"]
  },
  "video/h263": {
    "source": "iana",
    "extensions": ["h263"]
  },
  "video/h263-1998": {
    "source": "iana"
  },
  "video/h263-2000": {
    "source": "iana"
  },
  "video/h264": {
    "source": "iana",
    "extensions": ["h264"]
  },
  "video/h264-rcdo": {
    "source": "iana"
  },
  "video/h264-svc": {
    "source": "iana"
  },
  "video/h265": {
    "source": "iana"
  },
  "video/iso.segment": {
    "source": "iana",
    "extensions": ["m4s"]
  },
  "video/jpeg": {
    "source": "iana",
    "extensions": ["jpgv"]
  },
  "video/jpeg2000": {
    "source": "iana"
  },
  "video/jpm": {
    "source": "apache",
    "extensions": ["jpm","jpgm"]
  },
  "video/jxsv": {
    "source": "iana"
  },
  "video/mj2": {
    "source": "iana",
    "extensions": ["mj2","mjp2"]
  },
  "video/mp1s": {
    "source": "iana"
  },
  "video/mp2p": {
    "source": "iana"
  },
  "video/mp2t": {
    "source": "iana",
    "extensions": ["ts"]
  },
  "video/mp4": {
    "source": "iana",
    "compressible": false,
    "extensions": ["mp4","mp4v","mpg4"]
  },
  "video/mp4v-es": {
    "source": "iana"
  },
  "video/mpeg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["mpeg","mpg","mpe","m1v","m2v"]
  },
  "video/mpeg4-generic": {
    "source": "iana"
  },
  "video/mpv": {
    "source": "iana"
  },
  "video/nv": {
    "source": "iana"
  },
  "video/ogg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["ogv"]
  },
  "video/parityfec": {
    "source": "iana"
  },
  "video/pointer": {
    "source": "iana"
  },
  "video/quicktime": {
    "source": "iana",
    "compressible": false,
    "extensions": ["qt","mov"]
  },
  "video/raptorfec": {
    "source": "iana"
  },
  "video/raw": {
    "source": "iana"
  },
  "video/rtp-enc-aescm128": {
    "source": "iana"
  },
  "video/rtploopback": {
    "source": "iana"
  },
  "video/rtx": {
    "source": "iana"
  },
  "video/scip": {
    "source": "iana"
  },
  "video/smpte291": {
    "source": "iana"
  },
  "video/smpte292m": {
    "source": "iana"
  },
  "video/ulpfec": {
    "source": "iana"
  },
  "video/vc1": {
    "source": "iana"
  },
  "video/vc2": {
    "source": "iana"
  },
  "video/vnd.cctv": {
    "source": "iana"
  },
  "video/vnd.dece.hd": {
    "source": "iana",
    "extensions": ["uvh","uvvh"]
  },
  "video/vnd.dece.mobile": {
    "source": "iana",
    "extensions": ["uvm","uvvm"]
  },
  "video/vnd.dece.mp4": {
    "source": "iana"
  },
  "video/vnd.dece.pd": {
    "source": "iana",
    "extensions": ["uvp","uvvp"]
  },
  "video/vnd.dece.sd": {
    "source": "iana",
    "extensions": ["uvs","uvvs"]
  },
  "video/vnd.dece.video": {
    "source": "iana",
    "extensions": ["uvv","uvvv"]
  },
  "video/vnd.directv.mpeg": {
    "source": "iana"
  },
  "video/vnd.directv.mpeg-tts": {
    "source": "iana"
  },
  "video/vnd.dlna.mpeg-tts": {
    "source": "iana"
  },
  "video/vnd.dvb.file": {
    "source": "iana",
    "extensions": ["dvb"]
  },
  "video/vnd.fvt": {
    "source": "iana",
    "extensions": ["fvt"]
  },
  "video/vnd.hns.video": {
    "source": "iana"
  },
  "video/vnd.iptvforum.1dparityfec-1010": {
    "source": "iana"
  },
  "video/vnd.iptvforum.1dparityfec-2005": {
    "source": "iana"
  },
  "video/vnd.iptvforum.2dparityfec-1010": {
    "source": "iana"
  },
  "video/vnd.iptvforum.2dparityfec-2005": {
    "source": "iana"
  },
  "video/vnd.iptvforum.ttsavc": {
    "source": "iana"
  },
  "video/vnd.iptvforum.ttsmpeg2": {
    "source": "iana"
  },
  "video/vnd.motorola.video": {
    "source": "iana"
  },
  "video/vnd.motorola.videop": {
    "source": "iana"
  },
  "video/vnd.mpegurl": {
    "source": "iana",
    "extensions": ["mxu","m4u"]
  },
  "video/vnd.ms-playready.media.pyv": {
    "source": "iana",
    "extensions": ["pyv"]
  },
  "video/vnd.nokia.interleaved-multimedia": {
    "source": "iana"
  },
  "video/vnd.nokia.mp4vr": {
    "source": "iana"
  },
  "video/vnd.nokia.videovoip": {
    "source": "iana"
  },
  "video/vnd.objectvideo": {
    "source": "iana"
  },
  "video/vnd.radgamettools.bink": {
    "source": "iana"
  },
  "video/vnd.radgamettools.smacker": {
    "source": "iana"
  },
  "video/vnd.sealed.mpeg1": {
    "source": "iana"
  },
  "video/vnd.sealed.mpeg4": {
    "source": "iana"
  },
  "video/vnd.sealed.swf": {
    "source": "iana"
  },
  "video/vnd.sealedmedia.softseal.mov": {
    "source": "iana"
  },
  "video/vnd.uvvu.mp4": {
    "source": "iana",
    "extensions": ["uvu","uvvu"]
  },
  "video/vnd.vivo": {
    "source": "iana",
    "extensions": ["viv"]
  },
  "video/vnd.youtube.yt": {
    "source": "iana"
  },
  "video/vp8": {
    "source": "iana"
  },
  "video/vp9": {
    "source": "iana"
  },
  "video/webm": {
    "source": "apache",
    "compressible": false,
    "extensions": ["webm"]
  },
  "video/x-f4v": {
    "source": "apache",
    "extensions": ["f4v"]
  },
  "video/x-fli": {
    "source": "apache",
    "extensions": ["fli"]
  },
  "video/x-flv": {
    "source": "apache",
    "compressible": false,
    "extensions": ["flv"]
  },
  "video/x-m4v": {
    "source": "apache",
    "extensions": ["m4v"]
  },
  "video/x-matroska": {
    "source": "apache",
    "compressible": false,
    "extensions": ["mkv","mk3d","mks"]
  },
  "video/x-mng": {
    "source": "apache",
    "extensions": ["mng"]
  },
  "video/x-ms-asf": {
    "source": "apache",
    "extensions": ["asf","asx"]
  },
  "video/x-ms-vob": {
    "source": "apache",
    "extensions": ["vob"]
  },
  "video/x-ms-wm": {
    "source": "apache",
    "extensions": ["wm"]
  },
  "video/x-ms-wmv": {
    "source": "apache",
    "compressible": false,
    "extensions": ["wmv"]
  },
  "video/x-ms-wmx": {
    "source": "apache",
    "extensions": ["wmx"]
  },
  "video/x-ms-wvx": {
    "source": "apache",
    "extensions": ["wvx"]
  },
  "video/x-msvideo": {
    "source": "apache",
    "extensions": ["avi"]
  },
  "video/x-sgi-movie": {
    "source": "apache",
    "extensions": ["movie"]
  },
  "video/x-smv": {
    "source": "apache",
    "extensions": ["smv"]
  },
  "x-conference/x-cooltalk": {
    "source": "apache",
    "extensions": ["ice"]
  },
  "x-shader/x-fragment": {
    "compressible": true
  },
  "x-shader/x-vertex": {
    "compressible": true
  }
}
`);
const extensions = new Map();
const types = new Map();
function populateMaps(extensions, types) {
    const preference = [
        "nginx",
        "apache",
        undefined,
        "iana"
    ];
    for (const type of Object.keys(__default)){
        const mime = __default[type];
        const exts = mime.extensions;
        if (!exts || !exts.length) {
            continue;
        }
        extensions.set(type, exts);
        for (const ext of exts){
            const current = types.get(ext);
            if (current) {
                const from = preference.indexOf(__default[current].source);
                const to = preference.indexOf(mime.source);
                if (current !== "application/octet-stream" && (from > to || from === to && current.startsWith("application/"))) {
                    continue;
                }
            }
            types.set(ext, type);
        }
    }
}
populateMaps(extensions, types);
function lexer(str) {
    const tokens = [];
    let i = 0;
    while(i < str.length){
        const __char = str[i];
        if (__char === "*" || __char === "+" || __char === "?") {
            tokens.push({
                type: "MODIFIER",
                index: i,
                value: str[i++]
            });
            continue;
        }
        if (__char === "\\") {
            tokens.push({
                type: "ESCAPED_CHAR",
                index: i++,
                value: str[i++]
            });
            continue;
        }
        if (__char === "{") {
            tokens.push({
                type: "OPEN",
                index: i,
                value: str[i++]
            });
            continue;
        }
        if (__char === "}") {
            tokens.push({
                type: "CLOSE",
                index: i,
                value: str[i++]
            });
            continue;
        }
        if (__char === ":") {
            let name = "";
            let j = i + 1;
            while(j < str.length){
                const code = str.charCodeAt(j);
                if (code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95) {
                    name += str[j++];
                    continue;
                }
                break;
            }
            if (!name) throw new TypeError(`Missing parameter name at ${i}`);
            tokens.push({
                type: "NAME",
                index: i,
                value: name
            });
            i = j;
            continue;
        }
        if (__char === "(") {
            let count = 1;
            let pattern = "";
            let j1 = i + 1;
            if (str[j1] === "?") {
                throw new TypeError(`Pattern cannot start with "?" at ${j1}`);
            }
            while(j1 < str.length){
                if (str[j1] === "\\") {
                    pattern += str[j1++] + str[j1++];
                    continue;
                }
                if (str[j1] === ")") {
                    count--;
                    if (count === 0) {
                        j1++;
                        break;
                    }
                } else if (str[j1] === "(") {
                    count++;
                    if (str[j1 + 1] !== "?") {
                        throw new TypeError(`Capturing groups are not allowed at ${j1}`);
                    }
                }
                pattern += str[j1++];
            }
            if (count) throw new TypeError(`Unbalanced pattern at ${i}`);
            if (!pattern) throw new TypeError(`Missing pattern at ${i}`);
            tokens.push({
                type: "PATTERN",
                index: i,
                value: pattern
            });
            i = j1;
            continue;
        }
        tokens.push({
            type: "CHAR",
            index: i,
            value: str[i++]
        });
    }
    tokens.push({
        type: "END",
        index: i,
        value: ""
    });
    return tokens;
}
function parse3(str, options = {}) {
    const tokens = lexer(str);
    const { prefixes ="./"  } = options;
    const defaultPattern = `[^${escapeString(options.delimiter || "/#?")}]+?`;
    const result = [];
    let key = 0;
    let i = 0;
    let path = "";
    const tryConsume = (type)=>{
        if (i < tokens.length && tokens[i].type === type) return tokens[i++].value;
    };
    const mustConsume = (type)=>{
        const value = tryConsume(type);
        if (value !== undefined) return value;
        const { type: nextType , index  } = tokens[i];
        throw new TypeError(`Unexpected ${nextType} at ${index}, expected ${type}`);
    };
    const consumeText = ()=>{
        let result = "";
        let value;
        while(value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")){
            result += value;
        }
        return result;
    };
    while(i < tokens.length){
        const __char = tryConsume("CHAR");
        const name = tryConsume("NAME");
        const pattern = tryConsume("PATTERN");
        if (name || pattern) {
            let prefix = __char || "";
            if (prefixes.indexOf(prefix) === -1) {
                path += prefix;
                prefix = "";
            }
            if (path) {
                result.push(path);
                path = "";
            }
            result.push({
                name: name || key++,
                prefix,
                suffix: "",
                pattern: pattern || defaultPattern,
                modifier: tryConsume("MODIFIER") || ""
            });
            continue;
        }
        const value = __char || tryConsume("ESCAPED_CHAR");
        if (value) {
            path += value;
            continue;
        }
        if (path) {
            result.push(path);
            path = "";
        }
        const open = tryConsume("OPEN");
        if (open) {
            const prefix1 = consumeText();
            const name1 = tryConsume("NAME") || "";
            const pattern1 = tryConsume("PATTERN") || "";
            const suffix = consumeText();
            mustConsume("CLOSE");
            result.push({
                name: name1 || (pattern1 ? key++ : ""),
                pattern: name1 && !pattern1 ? defaultPattern : pattern1,
                prefix: prefix1,
                suffix,
                modifier: tryConsume("MODIFIER") || ""
            });
            continue;
        }
        mustConsume("END");
    }
    return result;
}
function compile(str, options) {
    return tokensToFunction(parse3(str, options), options);
}
function tokensToFunction(tokens, options = {}) {
    const reFlags = flags(options);
    const { encode =(x)=>x , validate =true  } = options;
    const matches = tokens.map((token)=>{
        if (typeof token === "object") {
            return new RegExp(`^(?:${token.pattern})$`, reFlags);
        }
    });
    return (data)=>{
        let path = "";
        for(let i = 0; i < tokens.length; i++){
            const token = tokens[i];
            if (typeof token === "string") {
                path += token;
                continue;
            }
            const value = data ? data[token.name] : undefined;
            const optional = token.modifier === "?" || token.modifier === "*";
            const repeat = token.modifier === "*" || token.modifier === "+";
            if (Array.isArray(value)) {
                if (!repeat) {
                    throw new TypeError(`Expected "${token.name}" to not repeat, but got an array`);
                }
                if (value.length === 0) {
                    if (optional) continue;
                    throw new TypeError(`Expected "${token.name}" to not be empty`);
                }
                for(let j = 0; j < value.length; j++){
                    const segment = encode(value[j], token);
                    if (validate && !matches[i].test(segment)) {
                        throw new TypeError(`Expected all "${token.name}" to match "${token.pattern}", but got "${segment}"`);
                    }
                    path += token.prefix + segment + token.suffix;
                }
                continue;
            }
            if (typeof value === "string" || typeof value === "number") {
                const segment1 = encode(String(value), token);
                if (validate && !matches[i].test(segment1)) {
                    throw new TypeError(`Expected "${token.name}" to match "${token.pattern}", but got "${segment1}"`);
                }
                path += token.prefix + segment1 + token.suffix;
                continue;
            }
            if (optional) continue;
            const typeOfMessage = repeat ? "an array" : "a string";
            throw new TypeError(`Expected "${token.name}" to be ${typeOfMessage}`);
        }
        return path;
    };
}
function escapeString(str) {
    return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
function flags(options) {
    return options && options.sensitive ? "" : "i";
}
function regexpToRegexp(path, keys) {
    if (!keys) return path;
    const groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
    let index = 0;
    let execResult = groupsRegex.exec(path.source);
    while(execResult){
        keys.push({
            name: execResult[1] || index++,
            prefix: "",
            suffix: "",
            modifier: "",
            pattern: ""
        });
        execResult = groupsRegex.exec(path.source);
    }
    return path;
}
function arrayToRegexp(paths, keys, options) {
    const parts = paths.map((path)=>pathToRegexp(path, keys, options).source);
    return new RegExp(`(?:${parts.join("|")})`, flags(options));
}
function stringToRegexp(path, keys, options) {
    return tokensToRegexp(parse3(path, options), keys, options);
}
function tokensToRegexp(tokens, keys, options = {}) {
    const { strict =false , start =true , end =true , encode =(x)=>x  } = options;
    const endsWith = `[${escapeString(options.endsWith || "")}]|$`;
    const delimiter = `[${escapeString(options.delimiter || "/#?")}]`;
    let route = start ? "^" : "";
    for (const token of tokens){
        if (typeof token === "string") {
            route += escapeString(encode(token));
        } else {
            const prefix = escapeString(encode(token.prefix));
            const suffix = escapeString(encode(token.suffix));
            if (token.pattern) {
                if (keys) keys.push(token);
                if (prefix || suffix) {
                    if (token.modifier === "+" || token.modifier === "*") {
                        const mod = token.modifier === "*" ? "?" : "";
                        route += `(?:${prefix}((?:${token.pattern})(?:${suffix}${prefix}(?:${token.pattern}))*)${suffix})${mod}`;
                    } else {
                        route += `(?:${prefix}(${token.pattern})${suffix})${token.modifier}`;
                    }
                } else {
                    route += `(${token.pattern})${token.modifier}`;
                }
            } else {
                route += `(?:${prefix}${suffix})${token.modifier}`;
            }
        }
    }
    if (end) {
        if (!strict) route += `${delimiter}?`;
        route += !options.endsWith ? "$" : `(?=${endsWith})`;
    } else {
        const endToken = tokens[tokens.length - 1];
        const isEndDelimited = typeof endToken === "string" ? delimiter.indexOf(endToken[endToken.length - 1]) > -1 : endToken === undefined;
        if (!strict) {
            route += `(?:${delimiter}(?=${endsWith}))?`;
        }
        if (!isEndDelimited) {
            route += `(?=${delimiter}|${endsWith})`;
        }
    }
    return new RegExp(route, flags(options));
}
function pathToRegexp(path, keys, options) {
    if (path instanceof RegExp) return regexpToRegexp(path, keys);
    if (Array.isArray(path)) return arrayToRegexp(path, keys, options);
    return stringToRegexp(path, keys, options);
}
const errorStatusMap = {
    "BadRequest": 400,
    "Unauthorized": 401,
    "PaymentRequired": 402,
    "Forbidden": 403,
    "NotFound": 404,
    "MethodNotAllowed": 405,
    "NotAcceptable": 406,
    "ProxyAuthRequired": 407,
    "RequestTimeout": 408,
    "Conflict": 409,
    "Gone": 410,
    "LengthRequired": 411,
    "PreconditionFailed": 412,
    "RequestEntityTooLarge": 413,
    "RequestURITooLong": 414,
    "UnsupportedMediaType": 415,
    "RequestedRangeNotSatisfiable": 416,
    "ExpectationFailed": 417,
    "Teapot": 418,
    "MisdirectedRequest": 421,
    "UnprocessableEntity": 422,
    "Locked": 423,
    "FailedDependency": 424,
    "UpgradeRequired": 426,
    "PreconditionRequired": 428,
    "TooManyRequests": 429,
    "RequestHeaderFieldsTooLarge": 431,
    "UnavailableForLegalReasons": 451,
    "InternalServerError": 500,
    "NotImplemented": 501,
    "BadGateway": 502,
    "ServiceUnavailable": 503,
    "GatewayTimeout": 504,
    "HTTPVersionNotSupported": 505,
    "VariantAlsoNegotiates": 506,
    "InsufficientStorage": 507,
    "LoopDetected": 508,
    "NotExtended": 510,
    "NetworkAuthenticationRequired": 511
};
class HttpError extends Error {
    expose = false;
    status = Status.InternalServerError;
}
function createHttpErrorConstructor(status) {
    const name = `${Status[status]}Error`;
    const Ctor = class extends HttpError {
        constructor(message){
            super(message || STATUS_TEXT.get(status));
            this.status = status;
            this.expose = status >= 400 && status < 500;
            Object.defineProperty(this, "name", {
                configurable: true,
                enumerable: false,
                value: name,
                writable: true
            });
        }
    };
    return Ctor;
}
const httpErrors = {};
for (const [key, value] of Object.entries(errorStatusMap)){
    httpErrors[key] = createHttpErrorConstructor(value);
}
"\t".charCodeAt(0);
" ".charCodeAt(0);
"\r".charCodeAt(0);
"\n".charCodeAt(0);
function assert1(cond, msg = "Assertion failed") {
    if (!cond) {
        throw new Error(msg);
    }
}
function decodeComponent(text) {
    try {
        return decodeURIComponent(text);
    } catch  {
        return text;
    }
}
new TextEncoder();
"\r".charCodeAt(0);
"\n".charCodeAt(0);
":".charCodeAt(0);
"\t".charCodeAt(0);
" ".charCodeAt(0);
new TextDecoder();
function toParamRegExp(attributePattern, flags) {
    return new RegExp(`(?:^|;)\\s*${attributePattern}\\s*=\\s*` + `(` + `[^";\\s][^;\\s]*` + `|` + `"(?:[^"\\\\]|\\\\"?)+"?` + `)`, flags);
}
toParamRegExp("filename\\*", "i");
toParamRegExp("filename\\*((?!0\\d)\\d+)(\\*?)", "ig");
toParamRegExp("filename", "i");
new TextDecoder();
new TextEncoder();
toParamRegExp("boundary", "i");
toParamRegExp("name", "i");
new TextDecoder();
globalThis.Response ?? class MockResponse {
};
"upgradeWebSocket" in Deno ? Deno.upgradeWebSocket.bind(Deno) : undefined;
Symbol("redirect backwards");
new TextEncoder();
new TextEncoder();
new TextEncoder();
[
    [
        "Connection",
        "Keep-Alive"
    ],
    [
        "Content-Type",
        "text/event-stream"
    ],
    [
        "Cache-Control",
        "no-cache"
    ],
    [
        "Keep-Alive",
        `timeout=${Number.MAX_SAFE_INTEGER}`
    ], 
];
"serveHttp" in Deno ? Deno.serveHttp.bind(Deno) : undefined;
function compose(middleware) {
    return function composedMiddleware(context, next) {
        let index = -1;
        async function dispatch(i) {
            if (i <= index) {
                throw new Error("next() called multiple times.");
            }
            index = i;
            let fn = middleware[i];
            if (i === middleware.length) {
                fn = next;
            }
            if (!fn) {
                return;
            }
            await fn(context, dispatch.bind(null, i + 1));
        }
        return dispatch(0);
    };
}
new WeakMap();
Deno?.core;
globalThis.structuredClone;
function toUrl(url, params = {}, options) {
    const tokens = parse3(url);
    let replace = {};
    if (tokens.some((token)=>typeof token === "object")) {
        replace = params;
    } else {
        options = params;
    }
    const toPath = compile(url, options);
    const replaced = toPath(replace);
    if (options && options.query) {
        const url1 = new URL(replaced, "http://oak");
        if (typeof options.query === "string") {
            url1.search = options.query;
        } else {
            url1.search = String(options.query instanceof URLSearchParams ? options.query : new URLSearchParams(options.query));
        }
        return `${url1.pathname}${url1.search}${url1.hash}`;
    }
    return replaced;
}
class Layer {
    #opts;
    #paramNames = [];
    #regexp;
    methods;
    name;
    path;
    stack;
    constructor(path, methods, middleware, { name , ...opts } = {}){
        this.#opts = opts;
        this.name = name;
        this.methods = [
            ...methods
        ];
        if (this.methods.includes("GET")) {
            this.methods.unshift("HEAD");
        }
        this.stack = Array.isArray(middleware) ? middleware.slice() : [
            middleware
        ];
        this.path = path;
        this.#regexp = pathToRegexp(path, this.#paramNames, this.#opts);
    }
    clone() {
        return new Layer(this.path, this.methods, this.stack, {
            name: this.name,
            ...this.#opts
        });
    }
    match(path) {
        return this.#regexp.test(path);
    }
    params(captures, existingParams = {}) {
        const params = existingParams;
        for(let i = 0; i < captures.length; i++){
            if (this.#paramNames[i]) {
                const c = captures[i];
                params[this.#paramNames[i].name] = c ? decodeComponent(c) : c;
            }
        }
        return params;
    }
    captures(path) {
        if (this.#opts.ignoreCaptures) {
            return [];
        }
        return path.match(this.#regexp)?.slice(1) ?? [];
    }
    url(params = {}, options) {
        const url = this.path.replace(/\(\.\*\)/g, "");
        return toUrl(url, params, options);
    }
    param(param, fn) {
        const stack = this.stack;
        const params = this.#paramNames;
        const middleware = function(ctx, next) {
            const p = ctx.params[param];
            assert1(p);
            return fn.call(this, p, ctx, next);
        };
        middleware.param = param;
        const names = params.map((p)=>p.name);
        const x = names.indexOf(param);
        if (x >= 0) {
            for(let i = 0; i < stack.length; i++){
                const fn1 = stack[i];
                if (!fn1.param || names.indexOf(fn1.param) > x) {
                    stack.splice(i, 0, middleware);
                    break;
                }
            }
        }
        return this;
    }
    setPrefix(prefix) {
        if (this.path) {
            this.path = this.path !== "/" || this.#opts.strict === true ? `${prefix}${this.path}` : prefix;
            this.#paramNames = [];
            this.#regexp = pathToRegexp(this.path, this.#paramNames, this.#opts);
        }
        return this;
    }
    toJSON() {
        return {
            methods: [
                ...this.methods
            ],
            middleware: [
                ...this.stack
            ],
            paramNames: this.#paramNames.map((key)=>key.name),
            path: this.path,
            regexp: this.#regexp,
            options: {
                ...this.#opts
            }
        };
    }
    [Symbol.for("Deno.customInspect")](inspect) {
        return `${this.constructor.name} ${inspect({
            methods: this.methods,
            middleware: this.stack,
            options: this.#opts,
            paramNames: this.#paramNames.map((key)=>key.name),
            path: this.path,
            regexp: this.#regexp
        })}`;
    }
    [Symbol.for("nodejs.util.inspect.custom")](depth, options, inspect) {
        if (depth < 0) {
            return options.stylize(`[${this.constructor.name}]`, "special");
        }
        const newOptions = Object.assign({}, options, {
            depth: options.depth === null ? null : options.depth - 1
        });
        return `${options.stylize(this.constructor.name, "special")} ${inspect({
            methods: this.methods,
            middleware: this.stack,
            options: this.#opts,
            paramNames: this.#paramNames.map((key)=>key.name),
            path: this.path,
            regexp: this.#regexp
        }, newOptions)}`;
    }
}
class Router {
    #opts;
    #methods;
    #params = {};
    #stack = [];
     #match(path2, method) {
        const matches = {
            path: [],
            pathAndMethod: [],
            route: false
        };
        for (const route of this.#stack){
            if (route.match(path2)) {
                matches.path.push(route);
                if (route.methods.length === 0 || route.methods.includes(method)) {
                    matches.pathAndMethod.push(route);
                    if (route.methods.length) {
                        matches.route = true;
                    }
                }
            }
        }
        return matches;
    }
     #register(path11, middlewares, methods, options = {}) {
        if (Array.isArray(path11)) {
            for (const p of path11){
                this.#register(p, middlewares, methods, options);
            }
            return;
        }
        let layerMiddlewares = [];
        for (const middleware of middlewares){
            if (!middleware.router) {
                layerMiddlewares.push(middleware);
                continue;
            }
            if (layerMiddlewares.length) {
                this.#addLayer(path11, layerMiddlewares, methods, options);
                layerMiddlewares = [];
            }
            const router = middleware.router.#clone();
            for (const layer of router.#stack){
                if (!options.ignorePrefix) {
                    layer.setPrefix(path11);
                }
                if (this.#opts.prefix) {
                    layer.setPrefix(this.#opts.prefix);
                }
                this.#stack.push(layer);
            }
            for (const [param, mw] of Object.entries(this.#params)){
                router.param(param, mw);
            }
        }
        if (layerMiddlewares.length) {
            this.#addLayer(path11, layerMiddlewares, methods, options);
        }
    }
     #addLayer(path21, middlewares1, methods1, options1 = {}) {
        const { end , name , sensitive =this.#opts.sensitive , strict =this.#opts.strict , ignoreCaptures ,  } = options1;
        const route1 = new Layer(path21, methods1, middlewares1, {
            end,
            name,
            sensitive,
            strict,
            ignoreCaptures
        });
        if (this.#opts.prefix) {
            route1.setPrefix(this.#opts.prefix);
        }
        for (const [param1, mw1] of Object.entries(this.#params)){
            route1.param(param1, mw1);
        }
        this.#stack.push(route1);
    }
     #route(name1) {
        for (const route2 of this.#stack){
            if (route2.name === name1) {
                return route2;
            }
        }
    }
     #useVerb(nameOrPath, pathOrMiddleware, middleware1, methods2) {
        let name2 = undefined;
        let path3;
        if (typeof pathOrMiddleware === "string") {
            name2 = nameOrPath;
            path3 = pathOrMiddleware;
        } else {
            path3 = nameOrPath;
            middleware1.unshift(pathOrMiddleware);
        }
        this.#register(path3, middleware1, methods2, {
            name: name2
        });
    }
     #clone() {
        const router1 = new Router(this.#opts);
        router1.#methods = router1.#methods.slice();
        router1.#params = {
            ...this.#params
        };
        router1.#stack = this.#stack.map((layer)=>layer.clone());
        return router1;
    }
    constructor(opts = {}){
        this.#opts = opts;
        this.#methods = opts.methods ?? [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT", 
        ];
    }
    all(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
            "DELETE",
            "GET",
            "POST",
            "PUT"
        ]);
        return this;
    }
    allowedMethods(options = {}) {
        const implemented = this.#methods;
        const allowedMethods = async (context, next)=>{
            const ctx = context;
            await next();
            if (!ctx.response.status || ctx.response.status === Status.NotFound) {
                assert1(ctx.matched);
                const allowed = new Set();
                for (const route of ctx.matched){
                    for (const method of route.methods){
                        allowed.add(method);
                    }
                }
                const allowedStr = [
                    ...allowed
                ].join(", ");
                if (!implemented.includes(ctx.request.method)) {
                    if (options.throw) {
                        throw options.notImplemented ? options.notImplemented() : new httpErrors.NotImplemented();
                    } else {
                        ctx.response.status = Status.NotImplemented;
                        ctx.response.headers.set("Allowed", allowedStr);
                    }
                } else if (allowed.size) {
                    if (ctx.request.method === "OPTIONS") {
                        ctx.response.status = Status.OK;
                        ctx.response.headers.set("Allowed", allowedStr);
                    } else if (!allowed.has(ctx.request.method)) {
                        if (options.throw) {
                            throw options.methodNotAllowed ? options.methodNotAllowed() : new httpErrors.MethodNotAllowed();
                        } else {
                            ctx.response.status = Status.MethodNotAllowed;
                            ctx.response.headers.set("Allowed", allowedStr);
                        }
                    }
                }
            }
        };
        return allowedMethods;
    }
    delete(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
            "DELETE"
        ]);
        return this;
    }
    *entries() {
        for (const route of this.#stack){
            const value = route.toJSON();
            yield [
                value,
                value
            ];
        }
    }
    forEach(callback, thisArg = null) {
        for (const route of this.#stack){
            const value = route.toJSON();
            callback.call(thisArg, value, value, this);
        }
    }
    get(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
            "GET"
        ]);
        return this;
    }
    head(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
            "HEAD"
        ]);
        return this;
    }
    *keys() {
        for (const route of this.#stack){
            yield route.toJSON();
        }
    }
    options(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
            "OPTIONS"
        ]);
        return this;
    }
    param(param, middleware) {
        this.#params[param] = middleware;
        for (const route of this.#stack){
            route.param(param, middleware);
        }
        return this;
    }
    patch(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
            "PATCH"
        ]);
        return this;
    }
    post(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
            "POST"
        ]);
        return this;
    }
    prefix(prefix) {
        prefix = prefix.replace(/\/$/, "");
        this.#opts.prefix = prefix;
        for (const route of this.#stack){
            route.setPrefix(prefix);
        }
        return this;
    }
    put(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
            "PUT"
        ]);
        return this;
    }
    redirect(source, destination, status = Status.Found) {
        if (source[0] !== "/") {
            const s = this.url(source);
            if (!s) {
                throw new RangeError(`Could not resolve named route: "${source}"`);
            }
            source = s;
        }
        if (typeof destination === "string") {
            if (destination[0] !== "/") {
                const d = this.url(destination);
                if (!d) {
                    try {
                        const url = new URL(destination);
                        destination = url;
                    } catch  {
                        throw new RangeError(`Could not resolve named route: "${source}"`);
                    }
                } else {
                    destination = d;
                }
            }
        }
        this.all(source, async (ctx, next)=>{
            await next();
            ctx.response.redirect(destination);
            ctx.response.status = status;
        });
        return this;
    }
    routes() {
        const dispatch = (context, next)=>{
            const ctx = context;
            let pathname;
            let method;
            try {
                const { url: { pathname: p  } , method: m  } = ctx.request;
                pathname = p;
                method = m;
            } catch (e) {
                return Promise.reject(e);
            }
            const path = (this.#opts.routerPath ?? ctx.routerPath) ?? decodeURI(pathname);
            const matches = this.#match(path, method);
            if (ctx.matched) {
                ctx.matched.push(...matches.path);
            } else {
                ctx.matched = [
                    ...matches.path
                ];
            }
            ctx.router = this;
            if (!matches.route) return next();
            const { pathAndMethod: matchedRoutes  } = matches;
            const chain = matchedRoutes.reduce((prev, route)=>[
                    ...prev,
                    (ctx, next)=>{
                        ctx.captures = route.captures(path);
                        ctx.params = route.params(ctx.captures, ctx.params);
                        ctx.routeName = route.name;
                        return next();
                    },
                    ...route.stack, 
                ], []);
            return compose(chain)(ctx, next);
        };
        dispatch.router = this;
        return dispatch;
    }
    url(name, params, options) {
        const route = this.#route(name);
        if (route) {
            return route.url(params, options);
        }
    }
    use(pathOrMiddleware, ...middleware) {
        let path;
        if (typeof pathOrMiddleware === "string" || Array.isArray(pathOrMiddleware)) {
            path = pathOrMiddleware;
        } else {
            middleware.unshift(pathOrMiddleware);
        }
        this.#register(path ?? "(.*)", middleware, [], {
            end: false,
            ignoreCaptures: !path,
            ignorePrefix: !path
        });
        return this;
    }
    *values() {
        for (const route of this.#stack){
            yield route.toJSON();
        }
    }
    *[Symbol.iterator]() {
        for (const route of this.#stack){
            yield route.toJSON();
        }
    }
    static url(path, params, options) {
        return toUrl(path, params, options);
    }
    [Symbol.for("Deno.customInspect")](inspect) {
        return `${this.constructor.name} ${inspect({
            "#params": this.#params,
            "#stack": this.#stack
        })}`;
    }
    [Symbol.for("nodejs.util.inspect.custom")](depth, options, inspect) {
        if (depth < 0) {
            return options.stylize(`[${this.constructor.name}]`, "special");
        }
        const newOptions = Object.assign({}, options, {
            depth: options.depth === null ? null : options.depth - 1
        });
        return `${options.stylize(this.constructor.name, "special")} ${inspect({
            "#params": this.#params,
            "#stack": this.#stack
        }, newOptions)}`;
    }
}
const { Deno: Deno1  } = globalThis;
typeof Deno1?.noColor === "boolean" ? Deno1.noColor : true;
new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))", 
].join("|"), "g");
var DiffType;
(function(DiffType) {
    DiffType["removed"] = "removed";
    DiffType["common"] = "common";
    DiffType["added"] = "added";
})(DiffType || (DiffType = {}));
const optionalTestDefinitionKeys = [
    "only",
    "permissions",
    "ignore",
    "sanitizeExit",
    "sanitizeOps",
    "sanitizeResources", 
];
const optionalTestStepDefinitionKeys = [
    "ignore",
    "sanitizeExit",
    "sanitizeOps",
    "sanitizeResources", 
];
class TestSuiteInternal {
    symbol;
    describe;
    steps;
    hasOnlyStep;
    constructor(describe){
        this.describe = describe;
        this.steps = [];
        this.hasOnlyStep = false;
        const { suite  } = describe;
        if (suite && !TestSuiteInternal.suites.has(suite.symbol)) {
            throw new Error("suite does not represent a registered test suite");
        }
        const testSuite = suite ? TestSuiteInternal.suites.get(suite.symbol) : TestSuiteInternal.current;
        this.symbol = Symbol();
        TestSuiteInternal.suites.set(this.symbol, this);
        const { fn  } = describe;
        if (fn) {
            const temp = TestSuiteInternal.current;
            TestSuiteInternal.current = this;
            try {
                fn();
            } finally{
                TestSuiteInternal.current = temp;
            }
        }
        if (testSuite) {
            TestSuiteInternal.addStep(testSuite, this);
        } else {
            const { name , ignore , permissions , sanitizeExit , sanitizeOps , sanitizeResources ,  } = describe;
            let { only  } = describe;
            if (!ignore && this.hasOnlyStep) {
                only = true;
            }
            TestSuiteInternal.registerTest({
                name,
                ignore,
                only,
                permissions,
                sanitizeExit,
                sanitizeOps,
                sanitizeResources,
                fn: async (t)=>{
                    TestSuiteInternal.runningCount++;
                    try {
                        const context = {};
                        const { beforeAll  } = this.describe;
                        if (typeof beforeAll === "function") {
                            await beforeAll.call(context);
                        } else if (beforeAll) {
                            for (const hook of beforeAll){
                                await hook.call(context);
                            }
                        }
                        try {
                            TestSuiteInternal.active.push(this.symbol);
                            await TestSuiteInternal.run(this, context, t);
                        } finally{
                            TestSuiteInternal.active.pop();
                            const { afterAll  } = this.describe;
                            if (typeof afterAll === "function") {
                                await afterAll.call(context);
                            } else if (afterAll) {
                                for (const hook1 of afterAll){
                                    await hook1.call(context);
                                }
                            }
                        }
                    } finally{
                        TestSuiteInternal.runningCount--;
                    }
                }
            });
        }
    }
    static runningCount = 0;
    static started = false;
    static suites = new Map();
    static current = null;
    static active = [];
    static reset() {
        TestSuiteInternal.runningCount = 0;
        TestSuiteInternal.started = false;
        TestSuiteInternal.current = null;
        TestSuiteInternal.active = [];
    }
    static registerTest(options) {
        options = {
            ...options
        };
        optionalTestDefinitionKeys.forEach((key)=>{
            if (typeof options[key] === "undefined") delete options[key];
        });
        Deno.test(options);
    }
    static addingOnlyStep(suite) {
        if (!suite.hasOnlyStep) {
            for(let i = 0; i < suite.steps.length; i++){
                const step = suite.steps[i];
                if (!(step instanceof TestSuiteInternal) && !step.only) {
                    suite.steps.splice(i--, 1);
                }
            }
            suite.hasOnlyStep = true;
        }
        const parentSuite = suite.describe.suite;
        const parentTestSuite = parentSuite && TestSuiteInternal.suites.get(parentSuite.symbol);
        if (parentTestSuite) {
            TestSuiteInternal.addingOnlyStep(parentTestSuite);
        }
    }
    static addStep(suite, step) {
        if (!suite.hasOnlyStep) {
            if (step instanceof TestSuiteInternal) {
                if (step.hasOnlyStep || step.describe.only) {
                    TestSuiteInternal.addingOnlyStep(suite);
                }
            } else {
                if (step.only) TestSuiteInternal.addingOnlyStep(suite);
            }
        }
        if (!(suite.hasOnlyStep && !(step instanceof TestSuiteInternal) && !step.only)) {
            suite.steps.push(step);
        }
    }
    static setHook(suite, name, fn) {
        if (suite.describe[name]) {
            if (typeof suite.describe[name] === "function") {
                suite.describe[name] = [
                    suite.describe[name], 
                ];
            }
            suite.describe[name].push(fn);
        } else {
            suite.describe[name] = fn;
        }
    }
    static async run(suite, context, t) {
        const hasOnly = suite.hasOnlyStep || suite.describe.only || false;
        for (const step of suite.steps){
            if (hasOnly && step instanceof TestSuiteInternal && !(step.hasOnlyStep || step.describe.only || false)) {
                continue;
            }
            const { name , fn , ignore , permissions , sanitizeExit , sanitizeOps , sanitizeResources ,  } = step instanceof TestSuiteInternal ? step.describe : step;
            const options = {
                name,
                ignore,
                sanitizeExit,
                sanitizeOps,
                sanitizeResources,
                fn: async (t)=>{
                    if (permissions) {
                        throw new Error("permissions option not available for nested tests");
                    }
                    context = {
                        ...context
                    };
                    if (step instanceof TestSuiteInternal) {
                        const { beforeAll  } = step.describe;
                        if (typeof beforeAll === "function") {
                            await beforeAll.call(context);
                        } else if (beforeAll) {
                            for (const hook of beforeAll){
                                await hook.call(context);
                            }
                        }
                        try {
                            TestSuiteInternal.active.push(step.symbol);
                            await TestSuiteInternal.run(step, context, t);
                        } finally{
                            TestSuiteInternal.active.pop();
                            const { afterAll  } = step.describe;
                            if (typeof afterAll === "function") {
                                await afterAll.call(context);
                            } else if (afterAll) {
                                for (const hook1 of afterAll){
                                    await hook1.call(context);
                                }
                            }
                        }
                    } else {
                        await TestSuiteInternal.runTest(t, fn, context);
                    }
                }
            };
            optionalTestStepDefinitionKeys.forEach((key)=>{
                if (typeof options[key] === "undefined") delete options[key];
            });
            await t.step(options);
        }
    }
    static async runTest(t, fn, context, activeIndex = 0) {
        const suite = TestSuiteInternal.active[activeIndex];
        const testSuite = suite && TestSuiteInternal.suites.get(suite);
        if (testSuite) {
            context = {
                ...context
            };
            const { beforeEach  } = testSuite.describe;
            if (typeof beforeEach === "function") {
                await beforeEach.call(context);
            } else if (beforeEach) {
                for (const hook of beforeEach){
                    await hook.call(context);
                }
            }
            try {
                await TestSuiteInternal.runTest(t, fn, context, activeIndex + 1);
            } finally{
                const { afterEach  } = testSuite.describe;
                if (typeof afterEach === "function") {
                    await afterEach.call(context);
                } else if (afterEach) {
                    for (const hook1 of afterEach){
                        await hook1.call(context);
                    }
                }
            }
        } else {
            await fn.call(context, t);
        }
    }
}
function itDefinition(...args) {
    let [suiteOptionsOrNameOrFn, optionsOrNameOrFn, optionsOrFn, fn, ] = args;
    let suite = undefined;
    let name;
    let options;
    if (typeof suiteOptionsOrNameOrFn === "object" && typeof suiteOptionsOrNameOrFn.symbol === "symbol") {
        suite = suiteOptionsOrNameOrFn;
    } else {
        fn = optionsOrFn;
        optionsOrFn = optionsOrNameOrFn;
        optionsOrNameOrFn = suiteOptionsOrNameOrFn;
    }
    if (typeof optionsOrNameOrFn === "string") {
        name = optionsOrNameOrFn;
        if (typeof optionsOrFn === "function") {
            fn = optionsOrFn;
            options = {};
        } else {
            options = optionsOrFn;
            if (!fn) fn = options.fn;
        }
    } else if (typeof optionsOrNameOrFn === "function") {
        fn = optionsOrNameOrFn;
        name = fn.name;
        options = {};
    } else {
        options = optionsOrNameOrFn;
        if (typeof optionsOrFn === "function") {
            fn = optionsOrFn;
        } else {
            fn = options.fn;
        }
        name = options.name ?? fn.name;
    }
    return {
        suite,
        ...options,
        name,
        fn
    };
}
function it(...args) {
    if (TestSuiteInternal.runningCount > 0) {
        throw new Error("cannot register new test cases after already registered test cases start running");
    }
    const options = itDefinition(...args);
    const { suite  } = options;
    const testSuite = suite ? TestSuiteInternal.suites.get(suite.symbol) : TestSuiteInternal.current;
    if (!TestSuiteInternal.started) TestSuiteInternal.started = true;
    if (testSuite) {
        TestSuiteInternal.addStep(testSuite, options);
    } else {
        const { name , fn , ignore , only , permissions , sanitizeExit , sanitizeOps , sanitizeResources ,  } = options;
        TestSuiteInternal.registerTest({
            name,
            ignore,
            only,
            permissions,
            sanitizeExit,
            sanitizeOps,
            sanitizeResources,
            async fn (t) {
                TestSuiteInternal.runningCount++;
                try {
                    await fn.call({}, t);
                } finally{
                    TestSuiteInternal.runningCount--;
                }
            }
        });
    }
}
it.only = function itOnly(...args) {
    const options = itDefinition(...args);
    return it({
        ...options,
        only: true
    });
};
it.ignore = function itIgnore(...args) {
    const options = itDefinition(...args);
    return it({
        ...options,
        ignore: true
    });
};
function describeDefinition(...args) {
    let [suiteOptionsOrNameOrFn, optionsOrNameOrFn, optionsOrFn, fn, ] = args;
    let suite = undefined;
    let name;
    let options;
    if (typeof suiteOptionsOrNameOrFn === "object" && typeof suiteOptionsOrNameOrFn.symbol === "symbol") {
        suite = suiteOptionsOrNameOrFn;
    } else {
        fn = optionsOrFn;
        optionsOrFn = optionsOrNameOrFn;
        optionsOrNameOrFn = suiteOptionsOrNameOrFn;
    }
    if (typeof optionsOrNameOrFn === "string") {
        name = optionsOrNameOrFn;
        if (typeof optionsOrFn === "function") {
            fn = optionsOrFn;
            options = {};
        } else {
            options = optionsOrFn ?? {};
            if (!fn) fn = options.fn;
        }
    } else if (typeof optionsOrNameOrFn === "function") {
        fn = optionsOrNameOrFn;
        name = fn.name;
        options = {};
    } else {
        options = optionsOrNameOrFn ?? {};
        if (typeof optionsOrFn === "function") {
            fn = optionsOrFn;
        } else {
            fn = options.fn;
        }
        name = (options.name ?? fn?.name) ?? "";
    }
    if (!suite) {
        suite = options.suite;
    }
    if (!suite && TestSuiteInternal.current) {
        const { symbol  } = TestSuiteInternal.current;
        suite = {
            symbol
        };
    }
    return {
        ...options,
        suite,
        name,
        fn
    };
}
function describe(...args) {
    if (TestSuiteInternal.runningCount > 0) {
        throw new Error("cannot register new test suites after already registered test cases start running");
    }
    const options = describeDefinition(...args);
    if (!TestSuiteInternal.started) TestSuiteInternal.started = true;
    const { symbol  } = new TestSuiteInternal(options);
    return {
        symbol
    };
}
describe.only = function describeOnly(...args) {
    const options = describeDefinition(...args);
    return describe({
        ...options,
        only: true
    });
};
describe.ignore = function describeIgnore(...args) {
    const options = describeDefinition(...args);
    return describe({
        ...options,
        ignore: true
    });
};
const version = '15.0.0';
const versionInfo = Object.freeze({
    major: 15,
    minor: 0,
    patch: 0,
    preReleaseTag: null
});
function isPromise(value) {
    return typeof value?.then === 'function';
}
const nodejsCustomInspectSymbol = typeof Symbol === 'function' && typeof Symbol.for === 'function' ? Symbol.for('nodejs.util.inspect.custom') : undefined;
function inspect(value) {
    return formatValue(value, []);
}
function formatValue(value, seenValues) {
    switch(typeof value){
        case 'string':
            return JSON.stringify(value);
        case 'function':
            return value.name ? `[function ${value.name}]` : '[function]';
        case 'object':
            if (value === null) {
                return 'null';
            }
            return formatObjectValue(value, seenValues);
        default:
            return String(value);
    }
}
function formatObjectValue(value, previouslySeenValues) {
    if (previouslySeenValues.indexOf(value) !== -1) {
        return '[Circular]';
    }
    const seenValues = [
        ...previouslySeenValues,
        value
    ];
    const customInspectFn = getCustomFn(value);
    if (customInspectFn !== undefined) {
        const customValue = customInspectFn.call(value);
        if (customValue !== value) {
            return typeof customValue === 'string' ? customValue : formatValue(customValue, seenValues);
        }
    } else if (Array.isArray(value)) {
        return formatArray(value, seenValues);
    }
    return formatObject(value, seenValues);
}
function formatObject(object, seenValues) {
    const keys = Object.keys(object);
    if (keys.length === 0) {
        return '{}';
    }
    if (seenValues.length > 2) {
        return '[' + getObjectTag(object) + ']';
    }
    const properties = keys.map((key)=>{
        const value = formatValue(object[key], seenValues);
        return key + ': ' + value;
    });
    return '{ ' + properties.join(', ') + ' }';
}
function formatArray(array, seenValues) {
    if (array.length === 0) {
        return '[]';
    }
    if (seenValues.length > 2) {
        return '[Array]';
    }
    const len = Math.min(10, array.length);
    const remaining = array.length - len;
    const items = [];
    for(let i = 0; i < len; ++i){
        items.push(formatValue(array[i], seenValues));
    }
    if (remaining === 1) {
        items.push('... 1 more item');
    } else if (remaining > 1) {
        items.push(`... ${remaining} more items`);
    }
    return '[' + items.join(', ') + ']';
}
function getCustomFn(object) {
    const customInspectFn = object[String(nodejsCustomInspectSymbol)];
    if (typeof customInspectFn === 'function') {
        return customInspectFn;
    }
    if (typeof object.inspect === 'function') {
        return object.inspect;
    }
}
function getObjectTag(object) {
    const tag = Object.prototype.toString.call(object).replace(/^\[object /, '').replace(/]$/, '');
    if (tag === 'Object' && typeof object.constructor === 'function') {
        const name = object.constructor.name;
        if (typeof name === 'string' && name !== '') {
            return name;
        }
    }
    return tag;
}
function devAssert(condition, message) {
    const booleanCondition = Boolean(condition);
    if (!booleanCondition) {
        throw new Error(message);
    }
}
function isObjectLike(value) {
    return typeof value == 'object' && value !== null;
}
const SYMBOL_ITERATOR = typeof Symbol === 'function' ? Symbol.iterator : '@@iterator';
const SYMBOL_ASYNC_ITERATOR = typeof Symbol === 'function' ? Symbol.asyncIterator : '@@asyncIterator';
const SYMBOL_TO_STRING_TAG = typeof Symbol === 'function' ? Symbol.toStringTag : '@@toStringTag';
function getLocation(source, position) {
    const lineRegexp = /\r\n|[\n\r]/g;
    let line = 1;
    let column = position + 1;
    let match;
    while((match = lineRegexp.exec(source.body)) && match.index < position){
        line += 1;
        column = position + 1 - (match.index + match[0].length);
    }
    return {
        line,
        column
    };
}
function printLocation(location) {
    return printSourceLocation(location.source, getLocation(location.source, location.start));
}
function printSourceLocation(source, sourceLocation) {
    const firstLineColumnOffset = source.locationOffset.column - 1;
    const body = whitespace(firstLineColumnOffset) + source.body;
    const lineIndex = sourceLocation.line - 1;
    const lineOffset = source.locationOffset.line - 1;
    const lineNum = sourceLocation.line + lineOffset;
    const columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0;
    const columnNum = sourceLocation.column + columnOffset;
    const locationStr = `${source.name}:${lineNum}:${columnNum}\n`;
    const lines = body.split(/\r\n|[\n\r]/g);
    const locationLine = lines[lineIndex];
    if (locationLine.length > 120) {
        const subLineIndex = Math.floor(columnNum / 80);
        const subLineColumnNum = columnNum % 80;
        const subLines = [];
        for(let i = 0; i < locationLine.length; i += 80){
            subLines.push(locationLine.slice(i, i + 80));
        }
        return locationStr + printPrefixedLines([
            [
                `${lineNum}`,
                subLines[0]
            ],
            ...subLines.slice(1, subLineIndex + 1).map((subLine)=>[
                    '',
                    subLine
                ]),
            [
                ' ',
                whitespace(subLineColumnNum - 1) + '^'
            ],
            [
                '',
                subLines[subLineIndex + 1]
            ]
        ]);
    }
    return locationStr + printPrefixedLines([
        [
            `${lineNum - 1}`,
            lines[lineIndex - 1]
        ],
        [
            `${lineNum}`,
            locationLine
        ],
        [
            '',
            whitespace(columnNum - 1) + '^'
        ],
        [
            `${lineNum + 1}`,
            lines[lineIndex + 1]
        ]
    ]);
}
function printPrefixedLines(lines) {
    const existingLines = lines.filter(([_, line])=>line !== undefined);
    const padLen = Math.max(...existingLines.map(([prefix])=>prefix.length));
    return existingLines.map(([prefix, line])=>leftPad(padLen, prefix) + (line ? ' | ' + line : ' |')).join('\n');
}
function whitespace(len) {
    return Array(len + 1).join(' ');
}
function leftPad(len, str) {
    return whitespace(len - str.length) + str;
}
class GraphQLError extends Error {
    constructor(message, nodes, source, positions, path, originalError, extensions){
        super(message);
        const _nodes = Array.isArray(nodes) ? nodes.length !== 0 ? nodes : undefined : nodes ? [
            nodes
        ] : undefined;
        let _source = source;
        if (!_source && _nodes) {
            _source = _nodes[0].loc?.source;
        }
        let _positions = positions;
        if (!_positions && _nodes) {
            _positions = _nodes.reduce((list, node)=>{
                if (node.loc) {
                    list.push(node.loc.start);
                }
                return list;
            }, []);
        }
        if (_positions && _positions.length === 0) {
            _positions = undefined;
        }
        let _locations;
        if (positions && source) {
            _locations = positions.map((pos)=>getLocation(source, pos));
        } else if (_nodes) {
            _locations = _nodes.reduce((list, node)=>{
                if (node.loc) {
                    list.push(getLocation(node.loc.source, node.loc.start));
                }
                return list;
            }, []);
        }
        let _extensions = extensions;
        if (_extensions == null && originalError != null) {
            const originalExtensions = originalError.extensions;
            if (isObjectLike(originalExtensions)) {
                _extensions = originalExtensions;
            }
        }
        Object.defineProperties(this, {
            name: {
                value: 'GraphQLError'
            },
            message: {
                value: message,
                enumerable: true,
                writable: true
            },
            locations: {
                value: _locations ?? undefined,
                enumerable: _locations != null
            },
            path: {
                value: path ?? undefined,
                enumerable: path != null
            },
            nodes: {
                value: _nodes ?? undefined
            },
            source: {
                value: _source ?? undefined
            },
            positions: {
                value: _positions ?? undefined
            },
            originalError: {
                value: originalError
            },
            extensions: {
                value: _extensions ?? undefined,
                enumerable: _extensions != null
            }
        });
        if (originalError?.stack) {
            Object.defineProperty(this, 'stack', {
                value: originalError.stack,
                writable: true,
                configurable: true
            });
            return;
        }
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, GraphQLError);
        } else {
            Object.defineProperty(this, 'stack', {
                value: Error().stack,
                writable: true,
                configurable: true
            });
        }
    }
    toString() {
        return printError(this);
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'Object';
    }
}
function printError(error) {
    let output = error.message;
    if (error.nodes) {
        for (const node of error.nodes){
            if (node.loc) {
                output += '\n\n' + printLocation(node.loc);
            }
        }
    } else if (error.source && error.locations) {
        for (const location of error.locations){
            output += '\n\n' + printSourceLocation(error.source, location);
        }
    }
    return output;
}
function syntaxError(source, position, description) {
    return new GraphQLError(`Syntax Error: ${description}`, undefined, source, [
        position
    ]);
}
const Kind = Object.freeze({
    NAME: 'Name',
    DOCUMENT: 'Document',
    OPERATION_DEFINITION: 'OperationDefinition',
    VARIABLE_DEFINITION: 'VariableDefinition',
    SELECTION_SET: 'SelectionSet',
    FIELD: 'Field',
    ARGUMENT: 'Argument',
    FRAGMENT_SPREAD: 'FragmentSpread',
    INLINE_FRAGMENT: 'InlineFragment',
    FRAGMENT_DEFINITION: 'FragmentDefinition',
    VARIABLE: 'Variable',
    INT: 'IntValue',
    FLOAT: 'FloatValue',
    STRING: 'StringValue',
    BOOLEAN: 'BooleanValue',
    NULL: 'NullValue',
    ENUM: 'EnumValue',
    LIST: 'ListValue',
    OBJECT: 'ObjectValue',
    OBJECT_FIELD: 'ObjectField',
    DIRECTIVE: 'Directive',
    NAMED_TYPE: 'NamedType',
    LIST_TYPE: 'ListType',
    NON_NULL_TYPE: 'NonNullType',
    SCHEMA_DEFINITION: 'SchemaDefinition',
    OPERATION_TYPE_DEFINITION: 'OperationTypeDefinition',
    SCALAR_TYPE_DEFINITION: 'ScalarTypeDefinition',
    OBJECT_TYPE_DEFINITION: 'ObjectTypeDefinition',
    FIELD_DEFINITION: 'FieldDefinition',
    INPUT_VALUE_DEFINITION: 'InputValueDefinition',
    INTERFACE_TYPE_DEFINITION: 'InterfaceTypeDefinition',
    UNION_TYPE_DEFINITION: 'UnionTypeDefinition',
    ENUM_TYPE_DEFINITION: 'EnumTypeDefinition',
    ENUM_VALUE_DEFINITION: 'EnumValueDefinition',
    INPUT_OBJECT_TYPE_DEFINITION: 'InputObjectTypeDefinition',
    DIRECTIVE_DEFINITION: 'DirectiveDefinition',
    SCHEMA_EXTENSION: 'SchemaExtension',
    SCALAR_TYPE_EXTENSION: 'ScalarTypeExtension',
    OBJECT_TYPE_EXTENSION: 'ObjectTypeExtension',
    INTERFACE_TYPE_EXTENSION: 'InterfaceTypeExtension',
    UNION_TYPE_EXTENSION: 'UnionTypeExtension',
    ENUM_TYPE_EXTENSION: 'EnumTypeExtension',
    INPUT_OBJECT_TYPE_EXTENSION: 'InputObjectTypeExtension'
});
class Source {
    constructor(body, name = 'GraphQL request', locationOffset = {
        line: 1,
        column: 1
    }){
        this.body = body;
        this.name = name;
        this.locationOffset = locationOffset;
        devAssert(this.locationOffset.line > 0, 'line in locationOffset is 1-indexed and must be positive.');
        devAssert(this.locationOffset.column > 0, 'column in locationOffset is 1-indexed and must be positive.');
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'Source';
    }
}
const DirectiveLocation = Object.freeze({
    QUERY: 'QUERY',
    MUTATION: 'MUTATION',
    SUBSCRIPTION: 'SUBSCRIPTION',
    FIELD: 'FIELD',
    FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION',
    FRAGMENT_SPREAD: 'FRAGMENT_SPREAD',
    INLINE_FRAGMENT: 'INLINE_FRAGMENT',
    VARIABLE_DEFINITION: 'VARIABLE_DEFINITION',
    SCHEMA: 'SCHEMA',
    SCALAR: 'SCALAR',
    OBJECT: 'OBJECT',
    FIELD_DEFINITION: 'FIELD_DEFINITION',
    ARGUMENT_DEFINITION: 'ARGUMENT_DEFINITION',
    INTERFACE: 'INTERFACE',
    UNION: 'UNION',
    ENUM: 'ENUM',
    ENUM_VALUE: 'ENUM_VALUE',
    INPUT_OBJECT: 'INPUT_OBJECT',
    INPUT_FIELD_DEFINITION: 'INPUT_FIELD_DEFINITION'
});
const TokenKind = Object.freeze({
    SOF: '<SOF>',
    EOF: '<EOF>',
    BANG: '!',
    DOLLAR: '$',
    AMP: '&',
    PAREN_L: '(',
    PAREN_R: ')',
    SPREAD: '...',
    COLON: ':',
    EQUALS: '=',
    AT: '@',
    BRACKET_L: '[',
    BRACKET_R: ']',
    BRACE_L: '{',
    PIPE: '|',
    BRACE_R: '}',
    NAME: 'Name',
    INT: 'Int',
    FLOAT: 'Float',
    STRING: 'String',
    BLOCK_STRING: 'BlockString',
    COMMENT: 'Comment'
});
function defineToJSON(classObject, fn = classObject.prototype.toString) {
    classObject.prototype.toJSON = fn;
    classObject.prototype.inspect = fn;
    if (nodejsCustomInspectSymbol) {
        classObject.prototype[nodejsCustomInspectSymbol] = fn;
    }
}
class Location {
    constructor(startToken, endToken, source){
        this.start = startToken.start;
        this.end = endToken.end;
        this.startToken = startToken;
        this.endToken = endToken;
        this.source = source;
    }
}
defineToJSON(Location, function() {
    return {
        start: this.start,
        end: this.end
    };
});
class Token {
    constructor(kind, start, end, line, column, prev, value){
        this.kind = kind;
        this.start = start;
        this.end = end;
        this.line = line;
        this.column = column;
        this.value = value;
        this.prev = prev;
        this.next = null;
    }
}
defineToJSON(Token, function() {
    return {
        kind: this.kind,
        value: this.value,
        line: this.line,
        column: this.column
    };
});
function isNode(maybeNode) {
    return maybeNode != null && typeof maybeNode.kind === 'string';
}
function dedentBlockStringValue(rawString) {
    const lines = rawString.split(/\r\n|[\n\r]/g);
    const commonIndent = getBlockStringIndentation(lines);
    if (commonIndent !== 0) {
        for(let i = 1; i < lines.length; i++){
            lines[i] = lines[i].slice(commonIndent);
        }
    }
    while(lines.length > 0 && isBlank(lines[0])){
        lines.shift();
    }
    while(lines.length > 0 && isBlank(lines[lines.length - 1])){
        lines.pop();
    }
    return lines.join('\n');
}
function getBlockStringIndentation(lines) {
    let commonIndent = null;
    for(let i = 1; i < lines.length; i++){
        const line = lines[i];
        const indent = leadingWhitespace(line);
        if (indent === line.length) {
            continue;
        }
        if (commonIndent === null || indent < commonIndent) {
            commonIndent = indent;
            if (commonIndent === 0) {
                break;
            }
        }
    }
    return commonIndent === null ? 0 : commonIndent;
}
function leadingWhitespace(str) {
    let i = 0;
    while(i < str.length && (str[i] === ' ' || str[i] === '\t')){
        i++;
    }
    return i;
}
function isBlank(str) {
    return leadingWhitespace(str) === str.length;
}
function printBlockString(value, indentation = '', preferMultipleLines = false) {
    const isSingleLine = value.indexOf('\n') === -1;
    const hasLeadingSpace = value[0] === ' ' || value[0] === '\t';
    const hasTrailingQuote = value[value.length - 1] === '"';
    const printAsMultipleLines = !isSingleLine || hasTrailingQuote || preferMultipleLines;
    let result = '';
    if (printAsMultipleLines && !(isSingleLine && hasLeadingSpace)) {
        result += '\n' + indentation;
    }
    result += indentation ? value.replace(/\n/g, '\n' + indentation) : value;
    if (printAsMultipleLines) {
        result += '\n';
    }
    return '"""' + result.replace(/"""/g, '\\"""') + '"""';
}
class Lexer {
    constructor(source){
        const startOfFileToken = new Token(TokenKind.SOF, 0, 0, 0, 0, null);
        this.source = source;
        this.lastToken = startOfFileToken;
        this.token = startOfFileToken;
        this.line = 1;
        this.lineStart = 0;
    }
    advance() {
        this.lastToken = this.token;
        const token = this.token = this.lookahead();
        return token;
    }
    lookahead() {
        let token = this.token;
        if (token.kind !== TokenKind.EOF) {
            do {
                token = token.next ?? (token.next = readToken(this, token));
            }while (token.kind === TokenKind.COMMENT)
        }
        return token;
    }
}
function isPunctuatorTokenKind(kind) {
    return kind === TokenKind.BANG || kind === TokenKind.DOLLAR || kind === TokenKind.AMP || kind === TokenKind.PAREN_L || kind === TokenKind.PAREN_R || kind === TokenKind.SPREAD || kind === TokenKind.COLON || kind === TokenKind.EQUALS || kind === TokenKind.AT || kind === TokenKind.BRACKET_L || kind === TokenKind.BRACKET_R || kind === TokenKind.BRACE_L || kind === TokenKind.PIPE || kind === TokenKind.BRACE_R;
}
function printCharCode(code) {
    return isNaN(code) ? TokenKind.EOF : code < 0x007f ? JSON.stringify(String.fromCharCode(code)) : `"\\u${('00' + code.toString(16).toUpperCase()).slice(-4)}"`;
}
function readToken(lexer, prev) {
    const source = lexer.source;
    const body = source.body;
    const bodyLength = body.length;
    const pos = positionAfterWhitespace(body, prev.end, lexer);
    const line = lexer.line;
    const col = 1 + pos - lexer.lineStart;
    if (pos >= bodyLength) {
        return new Token(TokenKind.EOF, bodyLength, bodyLength, line, col, prev);
    }
    const code = body.charCodeAt(pos);
    switch(code){
        case 33:
            return new Token(TokenKind.BANG, pos, pos + 1, line, col, prev);
        case 35:
            return readComment(source, pos, line, col, prev);
        case 36:
            return new Token(TokenKind.DOLLAR, pos, pos + 1, line, col, prev);
        case 38:
            return new Token(TokenKind.AMP, pos, pos + 1, line, col, prev);
        case 40:
            return new Token(TokenKind.PAREN_L, pos, pos + 1, line, col, prev);
        case 41:
            return new Token(TokenKind.PAREN_R, pos, pos + 1, line, col, prev);
        case 46:
            if (body.charCodeAt(pos + 1) === 46 && body.charCodeAt(pos + 2) === 46) {
                return new Token(TokenKind.SPREAD, pos, pos + 3, line, col, prev);
            }
            break;
        case 58:
            return new Token(TokenKind.COLON, pos, pos + 1, line, col, prev);
        case 61:
            return new Token(TokenKind.EQUALS, pos, pos + 1, line, col, prev);
        case 64:
            return new Token(TokenKind.AT, pos, pos + 1, line, col, prev);
        case 91:
            return new Token(TokenKind.BRACKET_L, pos, pos + 1, line, col, prev);
        case 93:
            return new Token(TokenKind.BRACKET_R, pos, pos + 1, line, col, prev);
        case 123:
            return new Token(TokenKind.BRACE_L, pos, pos + 1, line, col, prev);
        case 124:
            return new Token(TokenKind.PIPE, pos, pos + 1, line, col, prev);
        case 125:
            return new Token(TokenKind.BRACE_R, pos, pos + 1, line, col, prev);
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 95:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
            return readName(source, pos, line, col, prev);
        case 45:
        case 48:
        case 49:
        case 50:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
            return readNumber(source, pos, code, line, col, prev);
        case 34:
            if (body.charCodeAt(pos + 1) === 34 && body.charCodeAt(pos + 2) === 34) {
                return readBlockString(source, pos, line, col, prev, lexer);
            }
            return readString(source, pos, line, col, prev);
    }
    throw syntaxError(source, pos, unexpectedCharacterMessage(code));
}
function unexpectedCharacterMessage(code) {
    if (code < 0x0020 && code !== 0x0009 && code !== 0x000a && code !== 0x000d) {
        return `Cannot contain the invalid character ${printCharCode(code)}.`;
    }
    if (code === 39) {
        return 'Unexpected single quote character (\'), did you mean to use a double quote (")?';
    }
    return `Cannot parse the unexpected character ${printCharCode(code)}.`;
}
function positionAfterWhitespace(body, startPosition, lexer) {
    const bodyLength = body.length;
    let position = startPosition;
    while(position < bodyLength){
        const code = body.charCodeAt(position);
        if (code === 9 || code === 32 || code === 44 || code === 0xfeff) {
            ++position;
        } else if (code === 10) {
            ++position;
            ++lexer.line;
            lexer.lineStart = position;
        } else if (code === 13) {
            if (body.charCodeAt(position + 1) === 10) {
                position += 2;
            } else {
                ++position;
            }
            ++lexer.line;
            lexer.lineStart = position;
        } else {
            break;
        }
    }
    return position;
}
function readComment(source, start, line, col, prev) {
    const body = source.body;
    let code;
    let position = start;
    do {
        code = body.charCodeAt(++position);
    }while (!isNaN(code) && (code > 0x001f || code === 0x0009))
    return new Token(TokenKind.COMMENT, start, position, line, col, prev, body.slice(start + 1, position));
}
function readNumber(source, start, firstCode, line, col, prev) {
    const body = source.body;
    let code = firstCode;
    let position = start;
    let isFloat = false;
    if (code === 45) {
        code = body.charCodeAt(++position);
    }
    if (code === 48) {
        code = body.charCodeAt(++position);
        if (code >= 48 && code <= 57) {
            throw syntaxError(source, position, `Invalid number, unexpected digit after 0: ${printCharCode(code)}.`);
        }
    } else {
        position = readDigits(source, position, code);
        code = body.charCodeAt(position);
    }
    if (code === 46) {
        isFloat = true;
        code = body.charCodeAt(++position);
        position = readDigits(source, position, code);
        code = body.charCodeAt(position);
    }
    if (code === 69 || code === 101) {
        isFloat = true;
        code = body.charCodeAt(++position);
        if (code === 43 || code === 45) {
            code = body.charCodeAt(++position);
        }
        position = readDigits(source, position, code);
        code = body.charCodeAt(position);
    }
    if (code === 46 || isNameStart(code)) {
        throw syntaxError(source, position, `Invalid number, expected digit but got: ${printCharCode(code)}.`);
    }
    return new Token(isFloat ? TokenKind.FLOAT : TokenKind.INT, start, position, line, col, prev, body.slice(start, position));
}
function readDigits(source, start, firstCode) {
    const body = source.body;
    let position = start;
    let code = firstCode;
    if (code >= 48 && code <= 57) {
        do {
            code = body.charCodeAt(++position);
        }while (code >= 48 && code <= 57)
        return position;
    }
    throw syntaxError(source, position, `Invalid number, expected digit but got: ${printCharCode(code)}.`);
}
function readString(source, start, line, col, prev) {
    const body = source.body;
    let position = start + 1;
    let chunkStart = position;
    let code = 0;
    let value = '';
    while(position < body.length && !isNaN(code = body.charCodeAt(position)) && code !== 0x000a && code !== 0x000d){
        if (code === 34) {
            value += body.slice(chunkStart, position);
            return new Token(TokenKind.STRING, start, position + 1, line, col, prev, value);
        }
        if (code < 0x0020 && code !== 0x0009) {
            throw syntaxError(source, position, `Invalid character within String: ${printCharCode(code)}.`);
        }
        ++position;
        if (code === 92) {
            value += body.slice(chunkStart, position - 1);
            code = body.charCodeAt(position);
            switch(code){
                case 34:
                    value += '"';
                    break;
                case 47:
                    value += '/';
                    break;
                case 92:
                    value += '\\';
                    break;
                case 98:
                    value += '\b';
                    break;
                case 102:
                    value += '\f';
                    break;
                case 110:
                    value += '\n';
                    break;
                case 114:
                    value += '\r';
                    break;
                case 116:
                    value += '\t';
                    break;
                case 117:
                    {
                        const charCode = uniCharCode(body.charCodeAt(position + 1), body.charCodeAt(position + 2), body.charCodeAt(position + 3), body.charCodeAt(position + 4));
                        if (charCode < 0) {
                            const invalidSequence = body.slice(position + 1, position + 5);
                            throw syntaxError(source, position, `Invalid character escape sequence: \\u${invalidSequence}.`);
                        }
                        value += String.fromCharCode(charCode);
                        position += 4;
                        break;
                    }
                default:
                    throw syntaxError(source, position, `Invalid character escape sequence: \\${String.fromCharCode(code)}.`);
            }
            ++position;
            chunkStart = position;
        }
    }
    throw syntaxError(source, position, 'Unterminated string.');
}
function readBlockString(source, start, line, col, prev, lexer) {
    const body = source.body;
    let position = start + 3;
    let chunkStart = position;
    let code = 0;
    let rawValue = '';
    while(position < body.length && !isNaN(code = body.charCodeAt(position))){
        if (code === 34 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
            rawValue += body.slice(chunkStart, position);
            return new Token(TokenKind.BLOCK_STRING, start, position + 3, line, col, prev, dedentBlockStringValue(rawValue));
        }
        if (code < 0x0020 && code !== 0x0009 && code !== 0x000a && code !== 0x000d) {
            throw syntaxError(source, position, `Invalid character within String: ${printCharCode(code)}.`);
        }
        if (code === 10) {
            ++position;
            ++lexer.line;
            lexer.lineStart = position;
        } else if (code === 13) {
            if (body.charCodeAt(position + 1) === 10) {
                position += 2;
            } else {
                ++position;
            }
            ++lexer.line;
            lexer.lineStart = position;
        } else if (code === 92 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34 && body.charCodeAt(position + 3) === 34) {
            rawValue += body.slice(chunkStart, position) + '"""';
            position += 4;
            chunkStart = position;
        } else {
            ++position;
        }
    }
    throw syntaxError(source, position, 'Unterminated string.');
}
function uniCharCode(a, b, c, d) {
    return char2hex(a) << 12 | char2hex(b) << 8 | char2hex(c) << 4 | char2hex(d);
}
function char2hex(a) {
    return a >= 48 && a <= 57 ? a - 48 : a >= 65 && a <= 70 ? a - 55 : a >= 97 && a <= 102 ? a - 87 : -1;
}
function readName(source, start, line, col, prev) {
    const body = source.body;
    const bodyLength = body.length;
    let position = start + 1;
    let code = 0;
    while(position !== bodyLength && !isNaN(code = body.charCodeAt(position)) && (code === 95 || code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122)){
        ++position;
    }
    return new Token(TokenKind.NAME, start, position, line, col, prev, body.slice(start, position));
}
function isNameStart(code) {
    return code === 95 || code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
function parse4(source, options) {
    const parser = new Parser1(source, options);
    return parser.parseDocument();
}
function parseValue(source, options) {
    const parser = new Parser1(source, options);
    parser.expectToken(TokenKind.SOF);
    const value = parser.parseValueLiteral(false);
    parser.expectToken(TokenKind.EOF);
    return value;
}
function parseType(source, options) {
    const parser = new Parser1(source, options);
    parser.expectToken(TokenKind.SOF);
    const type = parser.parseTypeReference();
    parser.expectToken(TokenKind.EOF);
    return type;
}
class Parser1 {
    constructor(source, options){
        const sourceObj = typeof source === 'string' ? new Source(source) : source;
        devAssert(sourceObj instanceof Source, `Must provide Source. Received: ${inspect(sourceObj)}.`);
        this._lexer = new Lexer(sourceObj);
        this._options = options;
    }
    parseName() {
        const token = this.expectToken(TokenKind.NAME);
        return {
            kind: Kind.NAME,
            value: token.value,
            loc: this.loc(token)
        };
    }
    parseDocument() {
        const start = this._lexer.token;
        return {
            kind: Kind.DOCUMENT,
            definitions: this.many(TokenKind.SOF, this.parseDefinition, TokenKind.EOF),
            loc: this.loc(start)
        };
    }
    parseDefinition() {
        if (this.peek(TokenKind.NAME)) {
            switch(this._lexer.token.value){
                case 'query':
                case 'mutation':
                case 'subscription':
                    return this.parseOperationDefinition();
                case 'fragment':
                    return this.parseFragmentDefinition();
                case 'schema':
                case 'scalar':
                case 'type':
                case 'interface':
                case 'union':
                case 'enum':
                case 'input':
                case 'directive':
                    return this.parseTypeSystemDefinition();
                case 'extend':
                    return this.parseTypeSystemExtension();
            }
        } else if (this.peek(TokenKind.BRACE_L)) {
            return this.parseOperationDefinition();
        } else if (this.peekDescription()) {
            return this.parseTypeSystemDefinition();
        }
        throw this.unexpected();
    }
    parseOperationDefinition() {
        const start = this._lexer.token;
        if (this.peek(TokenKind.BRACE_L)) {
            return {
                kind: Kind.OPERATION_DEFINITION,
                operation: 'query',
                name: undefined,
                variableDefinitions: [],
                directives: [],
                selectionSet: this.parseSelectionSet(),
                loc: this.loc(start)
            };
        }
        const operation = this.parseOperationType();
        let name;
        if (this.peek(TokenKind.NAME)) {
            name = this.parseName();
        }
        return {
            kind: Kind.OPERATION_DEFINITION,
            operation,
            name,
            variableDefinitions: this.parseVariableDefinitions(),
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
            loc: this.loc(start)
        };
    }
    parseOperationType() {
        const operationToken = this.expectToken(TokenKind.NAME);
        switch(operationToken.value){
            case 'query':
                return 'query';
            case 'mutation':
                return 'mutation';
            case 'subscription':
                return 'subscription';
        }
        throw this.unexpected(operationToken);
    }
    parseVariableDefinitions() {
        return this.optionalMany(TokenKind.PAREN_L, this.parseVariableDefinition, TokenKind.PAREN_R);
    }
    parseVariableDefinition() {
        const start = this._lexer.token;
        return {
            kind: Kind.VARIABLE_DEFINITION,
            variable: this.parseVariable(),
            type: (this.expectToken(TokenKind.COLON), this.parseTypeReference()),
            defaultValue: this.expectOptionalToken(TokenKind.EQUALS) ? this.parseValueLiteral(true) : undefined,
            directives: this.parseDirectives(true),
            loc: this.loc(start)
        };
    }
    parseVariable() {
        const start = this._lexer.token;
        this.expectToken(TokenKind.DOLLAR);
        return {
            kind: Kind.VARIABLE,
            name: this.parseName(),
            loc: this.loc(start)
        };
    }
    parseSelectionSet() {
        const start = this._lexer.token;
        return {
            kind: Kind.SELECTION_SET,
            selections: this.many(TokenKind.BRACE_L, this.parseSelection, TokenKind.BRACE_R),
            loc: this.loc(start)
        };
    }
    parseSelection() {
        return this.peek(TokenKind.SPREAD) ? this.parseFragment() : this.parseField();
    }
    parseField() {
        const start = this._lexer.token;
        const nameOrAlias = this.parseName();
        let alias;
        let name;
        if (this.expectOptionalToken(TokenKind.COLON)) {
            alias = nameOrAlias;
            name = this.parseName();
        } else {
            name = nameOrAlias;
        }
        return {
            kind: Kind.FIELD,
            alias,
            name,
            arguments: this.parseArguments(false),
            directives: this.parseDirectives(false),
            selectionSet: this.peek(TokenKind.BRACE_L) ? this.parseSelectionSet() : undefined,
            loc: this.loc(start)
        };
    }
    parseArguments(isConst) {
        const item = isConst ? this.parseConstArgument : this.parseArgument;
        return this.optionalMany(TokenKind.PAREN_L, item, TokenKind.PAREN_R);
    }
    parseArgument() {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(TokenKind.COLON);
        return {
            kind: Kind.ARGUMENT,
            name,
            value: this.parseValueLiteral(false),
            loc: this.loc(start)
        };
    }
    parseConstArgument() {
        const start = this._lexer.token;
        return {
            kind: Kind.ARGUMENT,
            name: this.parseName(),
            value: (this.expectToken(TokenKind.COLON), this.parseValueLiteral(true)),
            loc: this.loc(start)
        };
    }
    parseFragment() {
        const start = this._lexer.token;
        this.expectToken(TokenKind.SPREAD);
        const hasTypeCondition = this.expectOptionalKeyword('on');
        if (!hasTypeCondition && this.peek(TokenKind.NAME)) {
            return {
                kind: Kind.FRAGMENT_SPREAD,
                name: this.parseFragmentName(),
                directives: this.parseDirectives(false),
                loc: this.loc(start)
            };
        }
        return {
            kind: Kind.INLINE_FRAGMENT,
            typeCondition: hasTypeCondition ? this.parseNamedType() : undefined,
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
            loc: this.loc(start)
        };
    }
    parseFragmentDefinition() {
        const start = this._lexer.token;
        this.expectKeyword('fragment');
        if (this._options?.experimentalFragmentVariables === true) {
            return {
                kind: Kind.FRAGMENT_DEFINITION,
                name: this.parseFragmentName(),
                variableDefinitions: this.parseVariableDefinitions(),
                typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
                directives: this.parseDirectives(false),
                selectionSet: this.parseSelectionSet(),
                loc: this.loc(start)
            };
        }
        return {
            kind: Kind.FRAGMENT_DEFINITION,
            name: this.parseFragmentName(),
            typeCondition: (this.expectKeyword('on'), this.parseNamedType()),
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
            loc: this.loc(start)
        };
    }
    parseFragmentName() {
        if (this._lexer.token.value === 'on') {
            throw this.unexpected();
        }
        return this.parseName();
    }
    parseValueLiteral(isConst) {
        const token = this._lexer.token;
        switch(token.kind){
            case TokenKind.BRACKET_L:
                return this.parseList(isConst);
            case TokenKind.BRACE_L:
                return this.parseObject(isConst);
            case TokenKind.INT:
                this._lexer.advance();
                return {
                    kind: Kind.INT,
                    value: token.value,
                    loc: this.loc(token)
                };
            case TokenKind.FLOAT:
                this._lexer.advance();
                return {
                    kind: Kind.FLOAT,
                    value: token.value,
                    loc: this.loc(token)
                };
            case TokenKind.STRING:
            case TokenKind.BLOCK_STRING:
                return this.parseStringLiteral();
            case TokenKind.NAME:
                this._lexer.advance();
                switch(token.value){
                    case 'true':
                        return {
                            kind: Kind.BOOLEAN,
                            value: true,
                            loc: this.loc(token)
                        };
                    case 'false':
                        return {
                            kind: Kind.BOOLEAN,
                            value: false,
                            loc: this.loc(token)
                        };
                    case 'null':
                        return {
                            kind: Kind.NULL,
                            loc: this.loc(token)
                        };
                    default:
                        return {
                            kind: Kind.ENUM,
                            value: token.value,
                            loc: this.loc(token)
                        };
                }
            case TokenKind.DOLLAR:
                if (!isConst) {
                    return this.parseVariable();
                }
                break;
        }
        throw this.unexpected();
    }
    parseStringLiteral() {
        const token = this._lexer.token;
        this._lexer.advance();
        return {
            kind: Kind.STRING,
            value: token.value,
            block: token.kind === TokenKind.BLOCK_STRING,
            loc: this.loc(token)
        };
    }
    parseList(isConst) {
        const start = this._lexer.token;
        const item = ()=>this.parseValueLiteral(isConst);
        return {
            kind: Kind.LIST,
            values: this.any(TokenKind.BRACKET_L, item, TokenKind.BRACKET_R),
            loc: this.loc(start)
        };
    }
    parseObject(isConst) {
        const start = this._lexer.token;
        const item = ()=>this.parseObjectField(isConst);
        return {
            kind: Kind.OBJECT,
            fields: this.any(TokenKind.BRACE_L, item, TokenKind.BRACE_R),
            loc: this.loc(start)
        };
    }
    parseObjectField(isConst) {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(TokenKind.COLON);
        return {
            kind: Kind.OBJECT_FIELD,
            name,
            value: this.parseValueLiteral(isConst),
            loc: this.loc(start)
        };
    }
    parseDirectives(isConst) {
        const directives = [];
        while(this.peek(TokenKind.AT)){
            directives.push(this.parseDirective(isConst));
        }
        return directives;
    }
    parseDirective(isConst) {
        const start = this._lexer.token;
        this.expectToken(TokenKind.AT);
        return {
            kind: Kind.DIRECTIVE,
            name: this.parseName(),
            arguments: this.parseArguments(isConst),
            loc: this.loc(start)
        };
    }
    parseTypeReference() {
        const start = this._lexer.token;
        let type;
        if (this.expectOptionalToken(TokenKind.BRACKET_L)) {
            type = this.parseTypeReference();
            this.expectToken(TokenKind.BRACKET_R);
            type = {
                kind: Kind.LIST_TYPE,
                type,
                loc: this.loc(start)
            };
        } else {
            type = this.parseNamedType();
        }
        if (this.expectOptionalToken(TokenKind.BANG)) {
            return {
                kind: Kind.NON_NULL_TYPE,
                type,
                loc: this.loc(start)
            };
        }
        return type;
    }
    parseNamedType() {
        const start = this._lexer.token;
        return {
            kind: Kind.NAMED_TYPE,
            name: this.parseName(),
            loc: this.loc(start)
        };
    }
    parseTypeSystemDefinition() {
        const keywordToken = this.peekDescription() ? this._lexer.lookahead() : this._lexer.token;
        if (keywordToken.kind === TokenKind.NAME) {
            switch(keywordToken.value){
                case 'schema':
                    return this.parseSchemaDefinition();
                case 'scalar':
                    return this.parseScalarTypeDefinition();
                case 'type':
                    return this.parseObjectTypeDefinition();
                case 'interface':
                    return this.parseInterfaceTypeDefinition();
                case 'union':
                    return this.parseUnionTypeDefinition();
                case 'enum':
                    return this.parseEnumTypeDefinition();
                case 'input':
                    return this.parseInputObjectTypeDefinition();
                case 'directive':
                    return this.parseDirectiveDefinition();
            }
        }
        throw this.unexpected(keywordToken);
    }
    peekDescription() {
        return this.peek(TokenKind.STRING) || this.peek(TokenKind.BLOCK_STRING);
    }
    parseDescription() {
        if (this.peekDescription()) {
            return this.parseStringLiteral();
        }
    }
    parseSchemaDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('schema');
        const directives = this.parseDirectives(true);
        const operationTypes = this.many(TokenKind.BRACE_L, this.parseOperationTypeDefinition, TokenKind.BRACE_R);
        return {
            kind: Kind.SCHEMA_DEFINITION,
            description,
            directives,
            operationTypes,
            loc: this.loc(start)
        };
    }
    parseOperationTypeDefinition() {
        const start = this._lexer.token;
        const operation = this.parseOperationType();
        this.expectToken(TokenKind.COLON);
        const type = this.parseNamedType();
        return {
            kind: Kind.OPERATION_TYPE_DEFINITION,
            operation,
            type,
            loc: this.loc(start)
        };
    }
    parseScalarTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('scalar');
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        return {
            kind: Kind.SCALAR_TYPE_DEFINITION,
            description,
            name,
            directives,
            loc: this.loc(start)
        };
    }
    parseObjectTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('type');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseDirectives(true);
        const fields = this.parseFieldsDefinition();
        return {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            description,
            name,
            interfaces,
            directives,
            fields,
            loc: this.loc(start)
        };
    }
    parseImplementsInterfaces() {
        const types = [];
        if (this.expectOptionalKeyword('implements')) {
            this.expectOptionalToken(TokenKind.AMP);
            do {
                types.push(this.parseNamedType());
            }while (this.expectOptionalToken(TokenKind.AMP) || this._options?.allowLegacySDLImplementsInterfaces === true && this.peek(TokenKind.NAME))
        }
        return types;
    }
    parseFieldsDefinition() {
        if (this._options?.allowLegacySDLEmptyFields === true && this.peek(TokenKind.BRACE_L) && this._lexer.lookahead().kind === TokenKind.BRACE_R) {
            this._lexer.advance();
            this._lexer.advance();
            return [];
        }
        return this.optionalMany(TokenKind.BRACE_L, this.parseFieldDefinition, TokenKind.BRACE_R);
    }
    parseFieldDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        const args = this.parseArgumentDefs();
        this.expectToken(TokenKind.COLON);
        const type = this.parseTypeReference();
        const directives = this.parseDirectives(true);
        return {
            kind: Kind.FIELD_DEFINITION,
            description,
            name,
            arguments: args,
            type,
            directives,
            loc: this.loc(start)
        };
    }
    parseArgumentDefs() {
        return this.optionalMany(TokenKind.PAREN_L, this.parseInputValueDef, TokenKind.PAREN_R);
    }
    parseInputValueDef() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        this.expectToken(TokenKind.COLON);
        const type = this.parseTypeReference();
        let defaultValue;
        if (this.expectOptionalToken(TokenKind.EQUALS)) {
            defaultValue = this.parseValueLiteral(true);
        }
        const directives = this.parseDirectives(true);
        return {
            kind: Kind.INPUT_VALUE_DEFINITION,
            description,
            name,
            type,
            defaultValue,
            directives,
            loc: this.loc(start)
        };
    }
    parseInterfaceTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('interface');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseDirectives(true);
        const fields = this.parseFieldsDefinition();
        return {
            kind: Kind.INTERFACE_TYPE_DEFINITION,
            description,
            name,
            interfaces,
            directives,
            fields,
            loc: this.loc(start)
        };
    }
    parseUnionTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('union');
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        const types = this.parseUnionMemberTypes();
        return {
            kind: Kind.UNION_TYPE_DEFINITION,
            description,
            name,
            directives,
            types,
            loc: this.loc(start)
        };
    }
    parseUnionMemberTypes() {
        const types = [];
        if (this.expectOptionalToken(TokenKind.EQUALS)) {
            this.expectOptionalToken(TokenKind.PIPE);
            do {
                types.push(this.parseNamedType());
            }while (this.expectOptionalToken(TokenKind.PIPE))
        }
        return types;
    }
    parseEnumTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('enum');
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        const values = this.parseEnumValuesDefinition();
        return {
            kind: Kind.ENUM_TYPE_DEFINITION,
            description,
            name,
            directives,
            values,
            loc: this.loc(start)
        };
    }
    parseEnumValuesDefinition() {
        return this.optionalMany(TokenKind.BRACE_L, this.parseEnumValueDefinition, TokenKind.BRACE_R);
    }
    parseEnumValueDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        return {
            kind: Kind.ENUM_VALUE_DEFINITION,
            description,
            name,
            directives,
            loc: this.loc(start)
        };
    }
    parseInputObjectTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('input');
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        const fields = this.parseInputFieldsDefinition();
        return {
            kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
            description,
            name,
            directives,
            fields,
            loc: this.loc(start)
        };
    }
    parseInputFieldsDefinition() {
        return this.optionalMany(TokenKind.BRACE_L, this.parseInputValueDef, TokenKind.BRACE_R);
    }
    parseTypeSystemExtension() {
        const keywordToken = this._lexer.lookahead();
        if (keywordToken.kind === TokenKind.NAME) {
            switch(keywordToken.value){
                case 'schema':
                    return this.parseSchemaExtension();
                case 'scalar':
                    return this.parseScalarTypeExtension();
                case 'type':
                    return this.parseObjectTypeExtension();
                case 'interface':
                    return this.parseInterfaceTypeExtension();
                case 'union':
                    return this.parseUnionTypeExtension();
                case 'enum':
                    return this.parseEnumTypeExtension();
                case 'input':
                    return this.parseInputObjectTypeExtension();
            }
        }
        throw this.unexpected(keywordToken);
    }
    parseSchemaExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('schema');
        const directives = this.parseDirectives(true);
        const operationTypes = this.optionalMany(TokenKind.BRACE_L, this.parseOperationTypeDefinition, TokenKind.BRACE_R);
        if (directives.length === 0 && operationTypes.length === 0) {
            throw this.unexpected();
        }
        return {
            kind: Kind.SCHEMA_EXTENSION,
            directives,
            operationTypes,
            loc: this.loc(start)
        };
    }
    parseScalarTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('scalar');
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        if (directives.length === 0) {
            throw this.unexpected();
        }
        return {
            kind: Kind.SCALAR_TYPE_EXTENSION,
            name,
            directives,
            loc: this.loc(start)
        };
    }
    parseObjectTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('type');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseDirectives(true);
        const fields = this.parseFieldsDefinition();
        if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
            throw this.unexpected();
        }
        return {
            kind: Kind.OBJECT_TYPE_EXTENSION,
            name,
            interfaces,
            directives,
            fields,
            loc: this.loc(start)
        };
    }
    parseInterfaceTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('interface');
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseDirectives(true);
        const fields = this.parseFieldsDefinition();
        if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
            throw this.unexpected();
        }
        return {
            kind: Kind.INTERFACE_TYPE_EXTENSION,
            name,
            interfaces,
            directives,
            fields,
            loc: this.loc(start)
        };
    }
    parseUnionTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('union');
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        const types = this.parseUnionMemberTypes();
        if (directives.length === 0 && types.length === 0) {
            throw this.unexpected();
        }
        return {
            kind: Kind.UNION_TYPE_EXTENSION,
            name,
            directives,
            types,
            loc: this.loc(start)
        };
    }
    parseEnumTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('enum');
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        const values = this.parseEnumValuesDefinition();
        if (directives.length === 0 && values.length === 0) {
            throw this.unexpected();
        }
        return {
            kind: Kind.ENUM_TYPE_EXTENSION,
            name,
            directives,
            values,
            loc: this.loc(start)
        };
    }
    parseInputObjectTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword('extend');
        this.expectKeyword('input');
        const name = this.parseName();
        const directives = this.parseDirectives(true);
        const fields = this.parseInputFieldsDefinition();
        if (directives.length === 0 && fields.length === 0) {
            throw this.unexpected();
        }
        return {
            kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
            name,
            directives,
            fields,
            loc: this.loc(start)
        };
    }
    parseDirectiveDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword('directive');
        this.expectToken(TokenKind.AT);
        const name = this.parseName();
        const args = this.parseArgumentDefs();
        const repeatable = this.expectOptionalKeyword('repeatable');
        this.expectKeyword('on');
        const locations = this.parseDirectiveLocations();
        return {
            kind: Kind.DIRECTIVE_DEFINITION,
            description,
            name,
            arguments: args,
            repeatable,
            locations,
            loc: this.loc(start)
        };
    }
    parseDirectiveLocations() {
        this.expectOptionalToken(TokenKind.PIPE);
        const locations = [];
        do {
            locations.push(this.parseDirectiveLocation());
        }while (this.expectOptionalToken(TokenKind.PIPE))
        return locations;
    }
    parseDirectiveLocation() {
        const start = this._lexer.token;
        const name = this.parseName();
        if (DirectiveLocation[name.value] !== undefined) {
            return name;
        }
        throw this.unexpected(start);
    }
    loc(startToken) {
        if (this._options?.noLocation !== true) {
            return new Location(startToken, this._lexer.lastToken, this._lexer.source);
        }
    }
    peek(kind) {
        return this._lexer.token.kind === kind;
    }
    expectToken(kind) {
        const token = this._lexer.token;
        if (token.kind === kind) {
            this._lexer.advance();
            return token;
        }
        throw syntaxError(this._lexer.source, token.start, `Expected ${getTokenKindDesc(kind)}, found ${getTokenDesc(token)}.`);
    }
    expectOptionalToken(kind) {
        const token = this._lexer.token;
        if (token.kind === kind) {
            this._lexer.advance();
            return token;
        }
        return undefined;
    }
    expectKeyword(value) {
        const token = this._lexer.token;
        if (token.kind === TokenKind.NAME && token.value === value) {
            this._lexer.advance();
        } else {
            throw syntaxError(this._lexer.source, token.start, `Expected "${value}", found ${getTokenDesc(token)}.`);
        }
    }
    expectOptionalKeyword(value) {
        const token = this._lexer.token;
        if (token.kind === TokenKind.NAME && token.value === value) {
            this._lexer.advance();
            return true;
        }
        return false;
    }
    unexpected(atToken) {
        const token = atToken ?? this._lexer.token;
        return syntaxError(this._lexer.source, token.start, `Unexpected ${getTokenDesc(token)}.`);
    }
    any(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        const nodes = [];
        while(!this.expectOptionalToken(closeKind)){
            nodes.push(parseFn.call(this));
        }
        return nodes;
    }
    optionalMany(openKind, parseFn, closeKind) {
        if (this.expectOptionalToken(openKind)) {
            const nodes = [];
            do {
                nodes.push(parseFn.call(this));
            }while (!this.expectOptionalToken(closeKind))
            return nodes;
        }
        return [];
    }
    many(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        const nodes = [];
        do {
            nodes.push(parseFn.call(this));
        }while (!this.expectOptionalToken(closeKind))
        return nodes;
    }
}
function getTokenDesc(token) {
    const value = token.value;
    return getTokenKindDesc(token.kind) + (value != null ? ` "${value}"` : '');
}
function getTokenKindDesc(kind) {
    return isPunctuatorTokenKind(kind) ? `"${kind}"` : kind;
}
const QueryDocumentKeys = {
    Name: [],
    Document: [
        'definitions'
    ],
    OperationDefinition: [
        'name',
        'variableDefinitions',
        'directives',
        'selectionSet'
    ],
    VariableDefinition: [
        'variable',
        'type',
        'defaultValue',
        'directives'
    ],
    Variable: [
        'name'
    ],
    SelectionSet: [
        'selections'
    ],
    Field: [
        'alias',
        'name',
        'arguments',
        'directives',
        'selectionSet'
    ],
    Argument: [
        'name',
        'value'
    ],
    FragmentSpread: [
        'name',
        'directives'
    ],
    InlineFragment: [
        'typeCondition',
        'directives',
        'selectionSet'
    ],
    FragmentDefinition: [
        'name',
        'variableDefinitions',
        'typeCondition',
        'directives',
        'selectionSet'
    ],
    IntValue: [],
    FloatValue: [],
    StringValue: [],
    BooleanValue: [],
    NullValue: [],
    EnumValue: [],
    ListValue: [
        'values'
    ],
    ObjectValue: [
        'fields'
    ],
    ObjectField: [
        'name',
        'value'
    ],
    Directive: [
        'name',
        'arguments'
    ],
    NamedType: [
        'name'
    ],
    ListType: [
        'type'
    ],
    NonNullType: [
        'type'
    ],
    SchemaDefinition: [
        'description',
        'directives',
        'operationTypes'
    ],
    OperationTypeDefinition: [
        'type'
    ],
    ScalarTypeDefinition: [
        'description',
        'name',
        'directives'
    ],
    ObjectTypeDefinition: [
        'description',
        'name',
        'interfaces',
        'directives',
        'fields'
    ],
    FieldDefinition: [
        'description',
        'name',
        'arguments',
        'type',
        'directives'
    ],
    InputValueDefinition: [
        'description',
        'name',
        'type',
        'defaultValue',
        'directives'
    ],
    InterfaceTypeDefinition: [
        'description',
        'name',
        'interfaces',
        'directives',
        'fields'
    ],
    UnionTypeDefinition: [
        'description',
        'name',
        'directives',
        'types'
    ],
    EnumTypeDefinition: [
        'description',
        'name',
        'directives',
        'values'
    ],
    EnumValueDefinition: [
        'description',
        'name',
        'directives'
    ],
    InputObjectTypeDefinition: [
        'description',
        'name',
        'directives',
        'fields'
    ],
    DirectiveDefinition: [
        'description',
        'name',
        'arguments',
        'locations'
    ],
    SchemaExtension: [
        'directives',
        'operationTypes'
    ],
    ScalarTypeExtension: [
        'name',
        'directives'
    ],
    ObjectTypeExtension: [
        'name',
        'interfaces',
        'directives',
        'fields'
    ],
    InterfaceTypeExtension: [
        'name',
        'interfaces',
        'directives',
        'fields'
    ],
    UnionTypeExtension: [
        'name',
        'directives',
        'types'
    ],
    EnumTypeExtension: [
        'name',
        'directives',
        'values'
    ],
    InputObjectTypeExtension: [
        'name',
        'directives',
        'fields'
    ]
};
const BREAK = Object.freeze({});
function visit(root, visitor, visitorKeys = QueryDocumentKeys) {
    let stack = undefined;
    let inArray = Array.isArray(root);
    let keys = [
        root
    ];
    let index = -1;
    let edits = [];
    let node = undefined;
    let key = undefined;
    let parent = undefined;
    const path = [];
    const ancestors = [];
    let newRoot = root;
    do {
        index++;
        const isLeaving = index === keys.length;
        const isEdited = isLeaving && edits.length !== 0;
        if (isLeaving) {
            key = ancestors.length === 0 ? undefined : path[path.length - 1];
            node = parent;
            parent = ancestors.pop();
            if (isEdited) {
                if (inArray) {
                    node = node.slice();
                } else {
                    const clone = {};
                    for (const k of Object.keys(node)){
                        clone[k] = node[k];
                    }
                    node = clone;
                }
                let editOffset = 0;
                for(let ii = 0; ii < edits.length; ii++){
                    let editKey = edits[ii][0];
                    const editValue = edits[ii][1];
                    if (inArray) {
                        editKey -= editOffset;
                    }
                    if (inArray && editValue === null) {
                        node.splice(editKey, 1);
                        editOffset++;
                    } else {
                        node[editKey] = editValue;
                    }
                }
            }
            index = stack.index;
            keys = stack.keys;
            edits = stack.edits;
            inArray = stack.inArray;
            stack = stack.prev;
        } else {
            key = parent ? inArray ? index : keys[index] : undefined;
            node = parent ? parent[key] : newRoot;
            if (node === null || node === undefined) {
                continue;
            }
            if (parent) {
                path.push(key);
            }
        }
        let result;
        if (!Array.isArray(node)) {
            if (!isNode(node)) {
                throw new Error(`Invalid AST Node: ${inspect(node)}.`);
            }
            const visitFn = getVisitFn(visitor, node.kind, isLeaving);
            if (visitFn) {
                result = visitFn.call(visitor, node, key, parent, path, ancestors);
                if (result === BREAK) {
                    break;
                }
                if (result === false) {
                    if (!isLeaving) {
                        path.pop();
                        continue;
                    }
                } else if (result !== undefined) {
                    edits.push([
                        key,
                        result
                    ]);
                    if (!isLeaving) {
                        if (isNode(result)) {
                            node = result;
                        } else {
                            path.pop();
                            continue;
                        }
                    }
                }
            }
        }
        if (result === undefined && isEdited) {
            edits.push([
                key,
                node
            ]);
        }
        if (isLeaving) {
            path.pop();
        } else {
            stack = {
                inArray,
                index,
                keys,
                edits,
                prev: stack
            };
            inArray = Array.isArray(node);
            keys = inArray ? node : visitorKeys[node.kind] ?? [];
            index = -1;
            edits = [];
            if (parent) {
                ancestors.push(parent);
            }
            parent = node;
        }
    }while (stack !== undefined)
    if (edits.length !== 0) {
        newRoot = edits[edits.length - 1][1];
    }
    return newRoot;
}
function visitInParallel(visitors) {
    const skipping = new Array(visitors.length);
    return {
        enter (node) {
            for(let i = 0; i < visitors.length; i++){
                if (skipping[i] == null) {
                    const fn = getVisitFn(visitors[i], node.kind, false);
                    if (fn) {
                        const result = fn.apply(visitors[i], arguments);
                        if (result === false) {
                            skipping[i] = node;
                        } else if (result === BREAK) {
                            skipping[i] = BREAK;
                        } else if (result !== undefined) {
                            return result;
                        }
                    }
                }
            }
        },
        leave (node) {
            for(let i = 0; i < visitors.length; i++){
                if (skipping[i] == null) {
                    const fn = getVisitFn(visitors[i], node.kind, true);
                    if (fn) {
                        const result = fn.apply(visitors[i], arguments);
                        if (result === BREAK) {
                            skipping[i] = BREAK;
                        } else if (result !== undefined && result !== false) {
                            return result;
                        }
                    }
                } else if (skipping[i] === node) {
                    skipping[i] = null;
                }
            }
        }
    };
}
function getVisitFn(visitor, kind, isLeaving) {
    const kindVisitor = visitor[kind];
    if (kindVisitor) {
        if (!isLeaving && typeof kindVisitor === 'function') {
            return kindVisitor;
        }
        const kindSpecificVisitor = isLeaving ? kindVisitor.leave : kindVisitor.enter;
        if (typeof kindSpecificVisitor === 'function') {
            return kindSpecificVisitor;
        }
    } else {
        const specificVisitor = isLeaving ? visitor.leave : visitor.enter;
        if (specificVisitor) {
            if (typeof specificVisitor === 'function') {
                return specificVisitor;
            }
            const specificKindVisitor = specificVisitor[kind];
            if (typeof specificKindVisitor === 'function') {
                return specificKindVisitor;
            }
        }
    }
}
const find = Array.prototype.find ? function(list, predicate) {
    return Array.prototype.find.call(list, predicate);
} : function(list, predicate) {
    for (const value of list){
        if (predicate(value)) {
            return value;
        }
    }
};
const flatMapMethod = Array.prototype.flatMap;
const flatMap = flatMapMethod ? function(list, fn) {
    return flatMapMethod.call(list, fn);
} : function(list, fn) {
    let result = [];
    for (const item of list){
        const value = fn(item);
        if (Array.isArray(value)) {
            result = result.concat(value);
        } else {
            result.push(value);
        }
    }
    return result;
};
const objectValues = Object.values || ((obj)=>Object.keys(obj).map((key)=>obj[key]));
function locatedError(originalError, nodes, path) {
    if (Array.isArray(originalError.path)) {
        return originalError;
    }
    return new GraphQLError(originalError.message, originalError.nodes ?? nodes, originalError.source, originalError.positions, path, originalError);
}
const NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;
function assertValidName(name) {
    const error = isValidNameError(name);
    if (error) {
        throw error;
    }
    return name;
}
function isValidNameError(name) {
    devAssert(typeof name === 'string', 'Expected name to be a string.');
    if (name.length > 1 && name[0] === '_' && name[1] === '_') {
        return new GraphQLError(`Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`);
    }
    if (!NAME_RX.test(name)) {
        return new GraphQLError(`Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "${name}" does not.`);
    }
}
const objectEntries = Object.entries || ((obj)=>Object.keys(obj).map((key)=>[
            key,
            obj[key]
        ]));
function keyMap(list, keyFn) {
    return list.reduce((map, item)=>{
        map[keyFn(item)] = item;
        return map;
    }, Object.create(null));
}
function mapValue(map, fn) {
    const result = Object.create(null);
    for (const [key, value] of objectEntries(map)){
        result[key] = fn(value, key);
    }
    return result;
}
function toObjMap(obj) {
    if (Object.getPrototypeOf(obj) === null) {
        return obj;
    }
    const map = Object.create(null);
    for (const [key, value] of objectEntries(obj)){
        map[key] = value;
    }
    return map;
}
function keyValMap(list, keyFn, valFn) {
    return list.reduce((map, item)=>{
        map[keyFn(item)] = valFn(item);
        return map;
    }, Object.create(null));
}
const __default1 = Deno.env.NODE_ENV === 'production' ? function instanceOf(value, constructor) {
    return value instanceof constructor;
} : function instanceOf(value, constructor) {
    if (value instanceof constructor) {
        return true;
    }
    if (value) {
        const valueClass = value.constructor;
        const className = constructor.name;
        if (className && valueClass && valueClass.name === className) {
            throw new Error(`Cannot use ${className} "${value}" from another module or realm.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`);
        }
    }
    return false;
};
function didYouMean(firstArg, secondArg) {
    const [subMessage, suggestionsArg] = typeof firstArg === 'string' ? [
        firstArg,
        secondArg
    ] : [
        undefined,
        firstArg
    ];
    let message = ' Did you mean ';
    if (subMessage) {
        message += subMessage + ' ';
    }
    const suggestions = suggestionsArg.map((x)=>`"${x}"`);
    switch(suggestions.length){
        case 0:
            return '';
        case 1:
            return message + suggestions[0] + '?';
        case 2:
            return message + suggestions[0] + ' or ' + suggestions[1] + '?';
    }
    const selected = suggestions.slice(0, 5);
    const lastItem = selected.pop();
    return message + selected.join(', ') + ', or ' + lastItem + '?';
}
function identityFunc(x) {
    return x;
}
function suggestionList(input, options) {
    const optionsByDistance = Object.create(null);
    const lexicalDistance = new LexicalDistance(input);
    const threshold = Math.floor(input.length * 0.4) + 1;
    for (const option of options){
        const distance = lexicalDistance.measure(option, threshold);
        if (distance !== undefined) {
            optionsByDistance[option] = distance;
        }
    }
    return Object.keys(optionsByDistance).sort((a, b)=>{
        const distanceDiff = optionsByDistance[a] - optionsByDistance[b];
        return distanceDiff !== 0 ? distanceDiff : a.localeCompare(b);
    });
}
class LexicalDistance {
    constructor(input){
        this._input = input;
        this._inputLowerCase = input.toLowerCase();
        this._inputArray = stringToArray(this._inputLowerCase);
        this._rows = [
            new Array(input.length + 1).fill(0),
            new Array(input.length + 1).fill(0),
            new Array(input.length + 1).fill(0)
        ];
    }
    measure(option, threshold) {
        if (this._input === option) {
            return 0;
        }
        const optionLowerCase = option.toLowerCase();
        if (this._inputLowerCase === optionLowerCase) {
            return 1;
        }
        let a = stringToArray(optionLowerCase);
        let b = this._inputArray;
        if (a.length < b.length) {
            const tmp = a;
            a = b;
            b = tmp;
        }
        const aLength = a.length;
        const bLength = b.length;
        if (aLength - bLength > threshold) {
            return undefined;
        }
        const rows = this._rows;
        for(let j = 0; j <= bLength; j++){
            rows[0][j] = j;
        }
        for(let i = 1; i <= aLength; i++){
            const upRow = rows[(i - 1) % 3];
            const currentRow = rows[i % 3];
            let smallestCell = currentRow[0] = i;
            for(let j1 = 1; j1 <= bLength; j1++){
                const cost = a[i - 1] === b[j1 - 1] ? 0 : 1;
                let currentCell = Math.min(upRow[j1] + 1, currentRow[j1 - 1] + 1, upRow[j1 - 1] + cost);
                if (i > 1 && j1 > 1 && a[i - 1] === b[j1 - 2] && a[i - 2] === b[j1 - 1]) {
                    const doubleDiagonalCell = rows[(i - 2) % 3][j1 - 2];
                    currentCell = Math.min(currentCell, doubleDiagonalCell + 1);
                }
                if (currentCell < smallestCell) {
                    smallestCell = currentCell;
                }
                currentRow[j1] = currentCell;
            }
            if (smallestCell > threshold) {
                return undefined;
            }
        }
        const distance = rows[aLength % 3][bLength];
        return distance <= threshold ? distance : undefined;
    }
}
function stringToArray(str) {
    const strLength = str.length;
    const array = new Array(strLength);
    for(let i = 0; i < strLength; ++i){
        array[i] = str.charCodeAt(i);
    }
    return array;
}
function print(ast) {
    return visit(ast, {
        leave: printDocASTReducer
    });
}
const printDocASTReducer = {
    Name: (node)=>node.value,
    Variable: (node)=>'$' + node.name,
    Document: (node)=>join4(node.definitions, '\n\n') + '\n',
    OperationDefinition (node) {
        const op = node.operation;
        const name = node.name;
        const varDefs = wrap('(', join4(node.variableDefinitions, ', '), ')');
        const directives = join4(node.directives, ' ');
        const selectionSet = node.selectionSet;
        return !name && !directives && !varDefs && op === 'query' ? selectionSet : join4([
            op,
            join4([
                name,
                varDefs
            ]),
            directives,
            selectionSet
        ], ' ');
    },
    VariableDefinition: ({ variable , type , defaultValue , directives  })=>variable + ': ' + type + wrap(' = ', defaultValue) + wrap(' ', join4(directives, ' ')),
    SelectionSet: ({ selections  })=>block(selections),
    Field: ({ alias , name , arguments: args , directives , selectionSet  })=>join4([
            wrap('', alias, ': ') + name + wrap('(', join4(args, ', '), ')'),
            join4(directives, ' '),
            selectionSet
        ], ' '),
    Argument: ({ name , value  })=>name + ': ' + value,
    FragmentSpread: ({ name , directives  })=>'...' + name + wrap(' ', join4(directives, ' ')),
    InlineFragment: ({ typeCondition , directives , selectionSet  })=>join4([
            '...',
            wrap('on ', typeCondition),
            join4(directives, ' '),
            selectionSet
        ], ' '),
    FragmentDefinition: ({ name , typeCondition , variableDefinitions , directives , selectionSet  })=>`fragment ${name}${wrap('(', join4(variableDefinitions, ', '), ')')} ` + `on ${typeCondition} ${wrap('', join4(directives, ' '), ' ')}` + selectionSet,
    IntValue: ({ value  })=>value,
    FloatValue: ({ value  })=>value,
    StringValue: ({ value , block: isBlockString  }, key)=>isBlockString ? printBlockString(value, key === 'description' ? '' : '  ') : JSON.stringify(value),
    BooleanValue: ({ value  })=>value ? 'true' : 'false',
    NullValue: ()=>'null',
    EnumValue: ({ value  })=>value,
    ListValue: ({ values  })=>'[' + join4(values, ', ') + ']',
    ObjectValue: ({ fields  })=>'{' + join4(fields, ', ') + '}',
    ObjectField: ({ name , value  })=>name + ': ' + value,
    Directive: ({ name , arguments: args  })=>'@' + name + wrap('(', join4(args, ', '), ')'),
    NamedType: ({ name  })=>name,
    ListType: ({ type  })=>'[' + type + ']',
    NonNullType: ({ type  })=>type + '!',
    SchemaDefinition: addDescription(({ directives , operationTypes  })=>join4([
            'schema',
            join4(directives, ' '),
            block(operationTypes)
        ], ' ')),
    OperationTypeDefinition: ({ operation , type  })=>operation + ': ' + type,
    ScalarTypeDefinition: addDescription(({ name , directives  })=>join4([
            'scalar',
            name,
            join4(directives, ' ')
        ], ' ')),
    ObjectTypeDefinition: addDescription(({ name , interfaces , directives , fields  })=>join4([
            'type',
            name,
            wrap('implements ', join4(interfaces, ' & ')),
            join4(directives, ' '),
            block(fields)
        ], ' ')),
    FieldDefinition: addDescription(({ name , arguments: args , type , directives  })=>name + (hasMultilineItems(args) ? wrap('(\n', indent(join4(args, '\n')), '\n)') : wrap('(', join4(args, ', '), ')')) + ': ' + type + wrap(' ', join4(directives, ' '))),
    InputValueDefinition: addDescription(({ name , type , defaultValue , directives  })=>join4([
            name + ': ' + type,
            wrap('= ', defaultValue),
            join4(directives, ' ')
        ], ' ')),
    InterfaceTypeDefinition: addDescription(({ name , interfaces , directives , fields  })=>join4([
            'interface',
            name,
            wrap('implements ', join4(interfaces, ' & ')),
            join4(directives, ' '),
            block(fields)
        ], ' ')),
    UnionTypeDefinition: addDescription(({ name , directives , types  })=>join4([
            'union',
            name,
            join4(directives, ' '),
            types && types.length !== 0 ? '= ' + join4(types, ' | ') : ''
        ], ' ')),
    EnumTypeDefinition: addDescription(({ name , directives , values  })=>join4([
            'enum',
            name,
            join4(directives, ' '),
            block(values)
        ], ' ')),
    EnumValueDefinition: addDescription(({ name , directives  })=>join4([
            name,
            join4(directives, ' ')
        ], ' ')),
    InputObjectTypeDefinition: addDescription(({ name , directives , fields  })=>join4([
            'input',
            name,
            join4(directives, ' '),
            block(fields)
        ], ' ')),
    DirectiveDefinition: addDescription(({ name , arguments: args , repeatable , locations  })=>'directive @' + name + (hasMultilineItems(args) ? wrap('(\n', indent(join4(args, '\n')), '\n)') : wrap('(', join4(args, ', '), ')')) + (repeatable ? ' repeatable' : '') + ' on ' + join4(locations, ' | ')),
    SchemaExtension: ({ directives , operationTypes  })=>join4([
            'extend schema',
            join4(directives, ' '),
            block(operationTypes)
        ], ' '),
    ScalarTypeExtension: ({ name , directives  })=>join4([
            'extend scalar',
            name,
            join4(directives, ' ')
        ], ' '),
    ObjectTypeExtension: ({ name , interfaces , directives , fields  })=>join4([
            'extend type',
            name,
            wrap('implements ', join4(interfaces, ' & ')),
            join4(directives, ' '),
            block(fields)
        ], ' '),
    InterfaceTypeExtension: ({ name , interfaces , directives , fields  })=>join4([
            'extend interface',
            name,
            wrap('implements ', join4(interfaces, ' & ')),
            join4(directives, ' '),
            block(fields)
        ], ' '),
    UnionTypeExtension: ({ name , directives , types  })=>join4([
            'extend union',
            name,
            join4(directives, ' '),
            types && types.length !== 0 ? '= ' + join4(types, ' | ') : ''
        ], ' '),
    EnumTypeExtension: ({ name , directives , values  })=>join4([
            'extend enum',
            name,
            join4(directives, ' '),
            block(values)
        ], ' '),
    InputObjectTypeExtension: ({ name , directives , fields  })=>join4([
            'extend input',
            name,
            join4(directives, ' '),
            block(fields)
        ], ' ')
};
function addDescription(cb) {
    return (node)=>join4([
            node.description,
            cb(node)
        ], '\n');
}
function join4(maybeArray, separator = '') {
    return maybeArray?.filter((x)=>x).join(separator) ?? '';
}
function block(array) {
    return array && array.length !== 0 ? '{\n' + indent(join4(array, '\n')) + '\n}' : '';
}
function wrap(start, maybeString, end = '') {
    return maybeString ? start + maybeString + end : '';
}
function indent(maybeString) {
    return maybeString && '  ' + maybeString.replace(/\n/g, '\n  ');
}
function isMultiline(string) {
    return string.indexOf('\n') !== -1;
}
function hasMultilineItems(maybeArray) {
    return maybeArray && maybeArray.some(isMultiline);
}
function invariant(condition, message) {
    const booleanCondition = Boolean(condition);
    if (!booleanCondition) {
        throw new Error(message != null ? message : 'Unexpected invariant triggered.');
    }
}
function valueFromASTUntyped(valueNode, variables) {
    switch(valueNode.kind){
        case Kind.NULL:
            return null;
        case Kind.INT:
            return parseInt(valueNode.value, 10);
        case Kind.FLOAT:
            return parseFloat(valueNode.value);
        case Kind.STRING:
        case Kind.ENUM:
        case Kind.BOOLEAN:
            return valueNode.value;
        case Kind.LIST:
            return valueNode.values.map((node)=>valueFromASTUntyped(node, variables));
        case Kind.OBJECT:
            return keyValMap(valueNode.fields, (field)=>field.name.value, (field)=>valueFromASTUntyped(field.value, variables));
        case Kind.VARIABLE:
            return variables?.[valueNode.name.value];
    }
    invariant(false, 'Unexpected value node: ' + inspect(valueNode));
}
function isType(type) {
    return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type) || isListType(type) || isNonNullType(type);
}
function assertType(type) {
    if (!isType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL type.`);
    }
    return type;
}
function isScalarType(type) {
    return __default1(type, GraphQLScalarType);
}
function assertScalarType(type) {
    if (!isScalarType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Scalar type.`);
    }
    return type;
}
function isObjectType(type) {
    return __default1(type, GraphQLObjectType);
}
function assertObjectType(type) {
    if (!isObjectType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Object type.`);
    }
    return type;
}
function isInterfaceType(type) {
    return __default1(type, GraphQLInterfaceType);
}
function assertInterfaceType(type) {
    if (!isInterfaceType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Interface type.`);
    }
    return type;
}
function isUnionType(type) {
    return __default1(type, GraphQLUnionType);
}
function assertUnionType(type) {
    if (!isUnionType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Union type.`);
    }
    return type;
}
function isEnumType(type) {
    return __default1(type, GraphQLEnumType);
}
function assertEnumType(type) {
    if (!isEnumType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Enum type.`);
    }
    return type;
}
function isInputObjectType(type) {
    return __default1(type, GraphQLInputObjectType);
}
function assertInputObjectType(type) {
    if (!isInputObjectType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Input Object type.`);
    }
    return type;
}
function isListType(type) {
    return __default1(type, GraphQLList);
}
function assertListType(type) {
    if (!isListType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL List type.`);
    }
    return type;
}
function isNonNullType(type) {
    return __default1(type, GraphQLNonNull);
}
function assertNonNullType(type) {
    if (!isNonNullType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
    }
    return type;
}
function isInputType(type) {
    return isScalarType(type) || isEnumType(type) || isInputObjectType(type) || isWrappingType(type) && isInputType(type.ofType);
}
function assertInputType(type) {
    if (!isInputType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL input type.`);
    }
    return type;
}
function isOutputType(type) {
    return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isWrappingType(type) && isOutputType(type.ofType);
}
function assertOutputType(type) {
    if (!isOutputType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL output type.`);
    }
    return type;
}
function isLeafType(type) {
    return isScalarType(type) || isEnumType(type);
}
function assertLeafType(type) {
    if (!isLeafType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL leaf type.`);
    }
    return type;
}
function isCompositeType(type) {
    return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}
function assertCompositeType(type) {
    if (!isCompositeType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL composite type.`);
    }
    return type;
}
function isAbstractType(type) {
    return isInterfaceType(type) || isUnionType(type);
}
function assertAbstractType(type) {
    if (!isAbstractType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL abstract type.`);
    }
    return type;
}
function GraphQLList(ofType) {
    if (this instanceof GraphQLList) {
        this.ofType = assertType(ofType);
    } else {
        return new GraphQLList(ofType);
    }
}
GraphQLList.prototype.toString = function toString() {
    return '[' + String(this.ofType) + ']';
};
Object.defineProperty(GraphQLList.prototype, SYMBOL_TO_STRING_TAG, {
    get () {
        return 'GraphQLList';
    }
});
defineToJSON(GraphQLList);
function GraphQLNonNull(ofType) {
    if (this instanceof GraphQLNonNull) {
        this.ofType = assertNullableType(ofType);
    } else {
        return new GraphQLNonNull(ofType);
    }
}
GraphQLNonNull.prototype.toString = function toString() {
    return String(this.ofType) + '!';
};
Object.defineProperty(GraphQLNonNull.prototype, SYMBOL_TO_STRING_TAG, {
    get () {
        return 'GraphQLNonNull';
    }
});
defineToJSON(GraphQLNonNull);
function isWrappingType(type) {
    return isListType(type) || isNonNullType(type);
}
function assertWrappingType(type) {
    if (!isWrappingType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL wrapping type.`);
    }
    return type;
}
function isNullableType(type) {
    return isType(type) && !isNonNullType(type);
}
function assertNullableType(type) {
    if (!isNullableType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL nullable type.`);
    }
    return type;
}
function getNullableType(type) {
    if (type) {
        return isNonNullType(type) ? type.ofType : type;
    }
}
function isNamedType(type) {
    return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type);
}
function assertNamedType(type) {
    if (!isNamedType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL named type.`);
    }
    return type;
}
function getNamedType(type) {
    if (type) {
        let unwrappedType = type;
        while(isWrappingType(unwrappedType)){
            unwrappedType = unwrappedType.ofType;
        }
        return unwrappedType;
    }
}
function resolveThunk(thunk) {
    return typeof thunk === 'function' ? thunk() : thunk;
}
function undefineIfEmpty(arr) {
    return arr && arr.length > 0 ? arr : undefined;
}
class GraphQLScalarType {
    constructor(config){
        const parseValue = config.parseValue ?? identityFunc;
        this.name = config.name;
        this.description = config.description;
        this.serialize = config.serialize ?? identityFunc;
        this.parseValue = parseValue;
        this.parseLiteral = config.parseLiteral ?? ((node)=>parseValue(valueFromASTUntyped(node)));
        this.extensions = config.extensions && toObjMap(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        devAssert(typeof config.name === 'string', 'Must provide name.');
        devAssert(config.serialize == null || typeof config.serialize === 'function', `${this.name} must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.`);
        if (config.parseLiteral) {
            devAssert(typeof config.parseValue === 'function' && typeof config.parseLiteral === 'function', `${this.name} must provide both "parseValue" and "parseLiteral" functions.`);
        }
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            serialize: this.serialize,
            parseValue: this.parseValue,
            parseLiteral: this.parseLiteral,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes ?? []
        };
    }
    toString() {
        return this.name;
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'GraphQLScalarType';
    }
}
defineToJSON(GraphQLScalarType);
class GraphQLObjectType {
    constructor(config){
        this.name = config.name;
        this.description = config.description;
        this.isTypeOf = config.isTypeOf;
        this.extensions = config.extensions && toObjMap(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._fields = defineFieldMap.bind(undefined, config);
        this._interfaces = defineInterfaces.bind(undefined, config);
        devAssert(typeof config.name === 'string', 'Must provide name.');
        devAssert(config.isTypeOf == null || typeof config.isTypeOf === 'function', `${this.name} must provide "isTypeOf" as a function, ` + `but got: ${inspect(config.isTypeOf)}.`);
    }
    getFields() {
        if (typeof this._fields === 'function') {
            this._fields = this._fields();
        }
        return this._fields;
    }
    getInterfaces() {
        if (typeof this._interfaces === 'function') {
            this._interfaces = this._interfaces();
        }
        return this._interfaces;
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            interfaces: this.getInterfaces(),
            fields: fieldsToFieldsConfig(this.getFields()),
            isTypeOf: this.isTypeOf,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes || []
        };
    }
    toString() {
        return this.name;
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'GraphQLObjectType';
    }
}
defineToJSON(GraphQLObjectType);
function defineInterfaces(config) {
    const interfaces = resolveThunk(config.interfaces) ?? [];
    devAssert(Array.isArray(interfaces), `${config.name} interfaces must be an Array or a function which returns an Array.`);
    return interfaces;
}
function defineFieldMap(config) {
    const fieldMap = resolveThunk(config.fields);
    devAssert(isPlainObj(fieldMap), `${config.name} fields must be an object with field names as keys or a function which returns such an object.`);
    return mapValue(fieldMap, (fieldConfig, fieldName)=>{
        devAssert(isPlainObj(fieldConfig), `${config.name}.${fieldName} field config must be an object.`);
        devAssert(!('isDeprecated' in fieldConfig), `${config.name}.${fieldName} should provide "deprecationReason" instead of "isDeprecated".`);
        devAssert(fieldConfig.resolve == null || typeof fieldConfig.resolve === 'function', `${config.name}.${fieldName} field resolver must be a function if ` + `provided, but got: ${inspect(fieldConfig.resolve)}.`);
        const argsConfig = fieldConfig.args ?? {};
        devAssert(isPlainObj(argsConfig), `${config.name}.${fieldName} args must be an object with argument names as keys.`);
        const args = objectEntries(argsConfig).map(([argName, argConfig])=>({
                name: argName,
                description: argConfig.description,
                type: argConfig.type,
                defaultValue: argConfig.defaultValue,
                extensions: argConfig.extensions && toObjMap(argConfig.extensions),
                astNode: argConfig.astNode
            }));
        return {
            name: fieldName,
            description: fieldConfig.description,
            type: fieldConfig.type,
            args,
            resolve: fieldConfig.resolve,
            subscribe: fieldConfig.subscribe,
            isDeprecated: fieldConfig.deprecationReason != null,
            deprecationReason: fieldConfig.deprecationReason,
            extensions: fieldConfig.extensions && toObjMap(fieldConfig.extensions),
            astNode: fieldConfig.astNode
        };
    });
}
function isPlainObj(obj) {
    return isObjectLike(obj) && !Array.isArray(obj);
}
function fieldsToFieldsConfig(fields) {
    return mapValue(fields, (field)=>({
            description: field.description,
            type: field.type,
            args: argsToArgsConfig(field.args),
            resolve: field.resolve,
            subscribe: field.subscribe,
            deprecationReason: field.deprecationReason,
            extensions: field.extensions,
            astNode: field.astNode
        }));
}
function argsToArgsConfig(args) {
    return keyValMap(args, (arg)=>arg.name, (arg)=>({
            description: arg.description,
            type: arg.type,
            defaultValue: arg.defaultValue,
            extensions: arg.extensions,
            astNode: arg.astNode
        }));
}
function isRequiredArgument(arg) {
    return isNonNullType(arg.type) && arg.defaultValue === undefined;
}
class GraphQLInterfaceType {
    constructor(config){
        this.name = config.name;
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = config.extensions && toObjMap(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._fields = defineFieldMap.bind(undefined, config);
        this._interfaces = defineInterfaces.bind(undefined, config);
        devAssert(typeof config.name === 'string', 'Must provide name.');
        devAssert(config.resolveType == null || typeof config.resolveType === 'function', `${this.name} must provide "resolveType" as a function, ` + `but got: ${inspect(config.resolveType)}.`);
    }
    getFields() {
        if (typeof this._fields === 'function') {
            this._fields = this._fields();
        }
        return this._fields;
    }
    getInterfaces() {
        if (typeof this._interfaces === 'function') {
            this._interfaces = this._interfaces();
        }
        return this._interfaces;
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            interfaces: this.getInterfaces(),
            fields: fieldsToFieldsConfig(this.getFields()),
            resolveType: this.resolveType,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes ?? []
        };
    }
    toString() {
        return this.name;
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'GraphQLInterfaceType';
    }
}
defineToJSON(GraphQLInterfaceType);
class GraphQLUnionType {
    constructor(config){
        this.name = config.name;
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = config.extensions && toObjMap(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._types = defineTypes.bind(undefined, config);
        devAssert(typeof config.name === 'string', 'Must provide name.');
        devAssert(config.resolveType == null || typeof config.resolveType === 'function', `${this.name} must provide "resolveType" as a function, ` + `but got: ${inspect(config.resolveType)}.`);
    }
    getTypes() {
        if (typeof this._types === 'function') {
            this._types = this._types();
        }
        return this._types;
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            types: this.getTypes(),
            resolveType: this.resolveType,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes ?? []
        };
    }
    toString() {
        return this.name;
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'GraphQLUnionType';
    }
}
defineToJSON(GraphQLUnionType);
function defineTypes(config) {
    const types = resolveThunk(config.types);
    devAssert(Array.isArray(types), `Must provide Array of types or a function which returns such an array for Union ${config.name}.`);
    return types;
}
class GraphQLEnumType {
    constructor(config){
        this.name = config.name;
        this.description = config.description;
        this.extensions = config.extensions && toObjMap(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._values = defineEnumValues(this.name, config.values);
        this._valueLookup = new Map(this._values.map((enumValue)=>[
                enumValue.value,
                enumValue
            ]));
        this._nameLookup = keyMap(this._values, (value)=>value.name);
        devAssert(typeof config.name === 'string', 'Must provide name.');
    }
    getValues() {
        return this._values;
    }
    getValue(name) {
        return this._nameLookup[name];
    }
    serialize(outputValue) {
        const enumValue = this._valueLookup.get(outputValue);
        if (enumValue === undefined) {
            throw new GraphQLError(`Enum "${this.name}" cannot represent value: ${inspect(outputValue)}`);
        }
        return enumValue.name;
    }
    parseValue(inputValue) {
        if (typeof inputValue !== 'string') {
            const valueStr = inspect(inputValue);
            throw new GraphQLError(`Enum "${this.name}" cannot represent non-string value: ${valueStr}.` + didYouMeanEnumValue(this, valueStr));
        }
        const enumValue = this.getValue(inputValue);
        if (enumValue == null) {
            throw new GraphQLError(`Value "${inputValue}" does not exist in "${this.name}" enum.` + didYouMeanEnumValue(this, inputValue));
        }
        return enumValue.value;
    }
    parseLiteral(valueNode, _variables) {
        if (valueNode.kind !== Kind.ENUM) {
            const valueStr = print(valueNode);
            throw new GraphQLError(`Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` + didYouMeanEnumValue(this, valueStr), valueNode);
        }
        const enumValue = this.getValue(valueNode.value);
        if (enumValue == null) {
            const valueStr1 = print(valueNode);
            throw new GraphQLError(`Value "${valueStr1}" does not exist in "${this.name}" enum.` + didYouMeanEnumValue(this, valueStr1), valueNode);
        }
        return enumValue.value;
    }
    toConfig() {
        const values = keyValMap(this.getValues(), (value)=>value.name, (value)=>({
                description: value.description,
                value: value.value,
                deprecationReason: value.deprecationReason,
                extensions: value.extensions,
                astNode: value.astNode
            }));
        return {
            name: this.name,
            description: this.description,
            values,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes ?? []
        };
    }
    toString() {
        return this.name;
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'GraphQLEnumType';
    }
}
defineToJSON(GraphQLEnumType);
function didYouMeanEnumValue(enumType, unknownValueStr) {
    const allNames = enumType.getValues().map((value)=>value.name);
    const suggestedValues = suggestionList(unknownValueStr, allNames);
    return didYouMean('the enum value', suggestedValues);
}
function defineEnumValues(typeName, valueMap) {
    devAssert(isPlainObj(valueMap), `${typeName} values must be an object with value names as keys.`);
    return objectEntries(valueMap).map(([valueName, valueConfig])=>{
        devAssert(isPlainObj(valueConfig), `${typeName}.${valueName} must refer to an object with a "value" key ` + `representing an internal value but got: ${inspect(valueConfig)}.`);
        devAssert(!('isDeprecated' in valueConfig), `${typeName}.${valueName} should provide "deprecationReason" instead of "isDeprecated".`);
        return {
            name: valueName,
            description: valueConfig.description,
            value: valueConfig.value !== undefined ? valueConfig.value : valueName,
            isDeprecated: valueConfig.deprecationReason != null,
            deprecationReason: valueConfig.deprecationReason,
            extensions: valueConfig.extensions && toObjMap(valueConfig.extensions),
            astNode: valueConfig.astNode
        };
    });
}
class GraphQLInputObjectType {
    constructor(config){
        this.name = config.name;
        this.description = config.description;
        this.extensions = config.extensions && toObjMap(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._fields = defineInputFieldMap.bind(undefined, config);
        devAssert(typeof config.name === 'string', 'Must provide name.');
    }
    getFields() {
        if (typeof this._fields === 'function') {
            this._fields = this._fields();
        }
        return this._fields;
    }
    toConfig() {
        const fields = mapValue(this.getFields(), (field)=>({
                description: field.description,
                type: field.type,
                defaultValue: field.defaultValue,
                extensions: field.extensions,
                astNode: field.astNode
            }));
        return {
            name: this.name,
            description: this.description,
            fields,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes ?? []
        };
    }
    toString() {
        return this.name;
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'GraphQLInputObjectType';
    }
}
defineToJSON(GraphQLInputObjectType);
function defineInputFieldMap(config) {
    const fieldMap = resolveThunk(config.fields);
    devAssert(isPlainObj(fieldMap), `${config.name} fields must be an object with field names as keys or a function which returns such an object.`);
    return mapValue(fieldMap, (fieldConfig, fieldName)=>{
        devAssert(!('resolve' in fieldConfig), `${config.name}.${fieldName} field has a resolve property, but Input Types cannot define resolvers.`);
        return {
            name: fieldName,
            description: fieldConfig.description,
            type: fieldConfig.type,
            defaultValue: fieldConfig.defaultValue,
            extensions: fieldConfig.extensions && toObjMap(fieldConfig.extensions),
            astNode: fieldConfig.astNode
        };
    });
}
function isRequiredInputField(field) {
    return isNonNullType(field.type) && field.defaultValue === undefined;
}
function isEqualType(typeA, typeB) {
    if (typeA === typeB) {
        return true;
    }
    if (isNonNullType(typeA) && isNonNullType(typeB)) {
        return isEqualType(typeA.ofType, typeB.ofType);
    }
    if (isListType(typeA) && isListType(typeB)) {
        return isEqualType(typeA.ofType, typeB.ofType);
    }
    return false;
}
function isTypeSubTypeOf(schema, maybeSubType, superType) {
    if (maybeSubType === superType) {
        return true;
    }
    if (isNonNullType(superType)) {
        if (isNonNullType(maybeSubType)) {
            return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
        }
        return false;
    }
    if (isNonNullType(maybeSubType)) {
        return isTypeSubTypeOf(schema, maybeSubType.ofType, superType);
    }
    if (isListType(superType)) {
        if (isListType(maybeSubType)) {
            return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
        }
        return false;
    }
    if (isListType(maybeSubType)) {
        return false;
    }
    return isAbstractType(superType) && (isInterfaceType(maybeSubType) || isObjectType(maybeSubType)) && schema.isSubType(superType, maybeSubType);
}
function doTypesOverlap(schema, typeA, typeB) {
    if (typeA === typeB) {
        return true;
    }
    if (isAbstractType(typeA)) {
        if (isAbstractType(typeB)) {
            return schema.getPossibleTypes(typeA).some((type)=>schema.isSubType(typeB, type));
        }
        return schema.isSubType(typeA, typeB);
    }
    if (isAbstractType(typeB)) {
        return schema.isSubType(typeB, typeA);
    }
    return false;
}
const isFinitePolyfill = Number.isFinite || function(value) {
    return typeof value === 'number' && isFinite(value);
};
const isInteger = Number.isInteger || function(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
};
const MIN_INT = -2147483648;
function serializeInt(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === 'boolean') {
        return coercedValue ? 1 : 0;
    }
    let num = coercedValue;
    if (typeof coercedValue === 'string' && coercedValue !== '') {
        num = Number(coercedValue);
    }
    if (!isInteger(num)) {
        throw new GraphQLError(`Int cannot represent non-integer value: ${inspect(coercedValue)}`);
    }
    if (num > 2147483647 || num < MIN_INT) {
        throw new GraphQLError('Int cannot represent non 32-bit signed integer value: ' + inspect(coercedValue));
    }
    return num;
}
function coerceInt(inputValue) {
    if (!isInteger(inputValue)) {
        throw new GraphQLError(`Int cannot represent non-integer value: ${inspect(inputValue)}`);
    }
    if (inputValue > 2147483647 || inputValue < MIN_INT) {
        throw new GraphQLError(`Int cannot represent non 32-bit signed integer value: ${inputValue}`);
    }
    return inputValue;
}
const GraphQLInt = new GraphQLScalarType({
    name: 'Int',
    description: 'The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.',
    serialize: serializeInt,
    parseValue: coerceInt,
    parseLiteral (valueNode) {
        if (valueNode.kind !== Kind.INT) {
            throw new GraphQLError(`Int cannot represent non-integer value: ${print(valueNode)}`, valueNode);
        }
        const num = parseInt(valueNode.value, 10);
        if (num > 2147483647 || num < MIN_INT) {
            throw new GraphQLError(`Int cannot represent non 32-bit signed integer value: ${valueNode.value}`, valueNode);
        }
        return num;
    }
});
function serializeFloat(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === 'boolean') {
        return coercedValue ? 1 : 0;
    }
    let num = coercedValue;
    if (typeof coercedValue === 'string' && coercedValue !== '') {
        num = Number(coercedValue);
    }
    if (!isFinitePolyfill(num)) {
        throw new GraphQLError(`Float cannot represent non numeric value: ${inspect(coercedValue)}`);
    }
    return num;
}
function coerceFloat(inputValue) {
    if (!isFinitePolyfill(inputValue)) {
        throw new GraphQLError(`Float cannot represent non numeric value: ${inspect(inputValue)}`);
    }
    return inputValue;
}
const GraphQLFloat = new GraphQLScalarType({
    name: 'Float',
    description: 'The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).',
    serialize: serializeFloat,
    parseValue: coerceFloat,
    parseLiteral (valueNode) {
        if (valueNode.kind !== Kind.FLOAT && valueNode.kind !== Kind.INT) {
            throw new GraphQLError(`Float cannot represent non numeric value: ${print(valueNode)}`, valueNode);
        }
        return parseFloat(valueNode.value);
    }
});
function serializeObject(outputValue) {
    if (isObjectLike(outputValue)) {
        if (typeof outputValue.valueOf === 'function') {
            const valueOfResult = outputValue.valueOf();
            if (!isObjectLike(valueOfResult)) {
                return valueOfResult;
            }
        }
        if (typeof outputValue.toJSON === 'function') {
            return outputValue.toJSON();
        }
    }
    return outputValue;
}
function serializeString(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === 'string') {
        return coercedValue;
    }
    if (typeof coercedValue === 'boolean') {
        return coercedValue ? 'true' : 'false';
    }
    if (isFinitePolyfill(coercedValue)) {
        return coercedValue.toString();
    }
    throw new GraphQLError(`String cannot represent value: ${inspect(outputValue)}`);
}
function coerceString(inputValue) {
    if (typeof inputValue !== 'string') {
        throw new GraphQLError(`String cannot represent a non string value: ${inspect(inputValue)}`);
    }
    return inputValue;
}
const GraphQLString = new GraphQLScalarType({
    name: 'String',
    description: 'The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.',
    serialize: serializeString,
    parseValue: coerceString,
    parseLiteral (valueNode) {
        if (valueNode.kind !== Kind.STRING) {
            throw new GraphQLError(`String cannot represent a non string value: ${print(valueNode)}`, valueNode);
        }
        return valueNode.value;
    }
});
function serializeBoolean(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === 'boolean') {
        return coercedValue;
    }
    if (isFinitePolyfill(coercedValue)) {
        return coercedValue !== 0;
    }
    throw new GraphQLError(`Boolean cannot represent a non boolean value: ${inspect(coercedValue)}`);
}
function coerceBoolean(inputValue) {
    if (typeof inputValue !== 'boolean') {
        throw new GraphQLError(`Boolean cannot represent a non boolean value: ${inspect(inputValue)}`);
    }
    return inputValue;
}
const GraphQLBoolean = new GraphQLScalarType({
    name: 'Boolean',
    description: 'The `Boolean` scalar type represents `true` or `false`.',
    serialize: serializeBoolean,
    parseValue: coerceBoolean,
    parseLiteral (valueNode) {
        if (valueNode.kind !== Kind.BOOLEAN) {
            throw new GraphQLError(`Boolean cannot represent a non boolean value: ${print(valueNode)}`, valueNode);
        }
        return valueNode.value;
    }
});
function serializeID(outputValue) {
    const coercedValue = serializeObject(outputValue);
    if (typeof coercedValue === 'string') {
        return coercedValue;
    }
    if (isInteger(coercedValue)) {
        return String(coercedValue);
    }
    throw new GraphQLError(`ID cannot represent value: ${inspect(outputValue)}`);
}
function coerceID(inputValue) {
    if (typeof inputValue === 'string') {
        return inputValue;
    }
    if (isInteger(inputValue)) {
        return inputValue.toString();
    }
    throw new GraphQLError(`ID cannot represent value: ${inspect(inputValue)}`);
}
const GraphQLID = new GraphQLScalarType({
    name: 'ID',
    description: 'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
    serialize: serializeID,
    parseValue: coerceID,
    parseLiteral (valueNode) {
        if (valueNode.kind !== Kind.STRING && valueNode.kind !== Kind.INT) {
            throw new GraphQLError('ID cannot represent a non-string and non-integer value: ' + print(valueNode), valueNode);
        }
        return valueNode.value;
    }
});
const specifiedScalarTypes = Object.freeze([
    GraphQLString,
    GraphQLInt,
    GraphQLFloat,
    GraphQLBoolean,
    GraphQLID
]);
function isSpecifiedScalarType(type) {
    return specifiedScalarTypes.some(({ name  })=>type.name === name);
}
function isDirective(directive) {
    return __default1(directive, GraphQLDirective);
}
function assertDirective(directive) {
    if (!isDirective(directive)) {
        throw new Error(`Expected ${inspect(directive)} to be a GraphQL directive.`);
    }
    return directive;
}
class GraphQLDirective {
    constructor(config){
        this.name = config.name;
        this.description = config.description;
        this.locations = config.locations;
        this.isRepeatable = config.isRepeatable ?? false;
        this.extensions = config.extensions && toObjMap(config.extensions);
        this.astNode = config.astNode;
        devAssert(config.name, 'Directive must be named.');
        devAssert(Array.isArray(config.locations), `@${config.name} locations must be an Array.`);
        const args = config.args ?? {};
        devAssert(isObjectLike(args) && !Array.isArray(args), `@${config.name} args must be an object with argument names as keys.`);
        this.args = objectEntries(args).map(([argName, argConfig])=>({
                name: argName,
                description: argConfig.description,
                type: argConfig.type,
                defaultValue: argConfig.defaultValue,
                extensions: argConfig.extensions && toObjMap(argConfig.extensions),
                astNode: argConfig.astNode
            }));
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            locations: this.locations,
            args: argsToArgsConfig(this.args),
            isRepeatable: this.isRepeatable,
            extensions: this.extensions,
            astNode: this.astNode
        };
    }
    toString() {
        return '@' + this.name;
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'GraphQLDirective';
    }
}
defineToJSON(GraphQLDirective);
const GraphQLIncludeDirective = new GraphQLDirective({
    name: 'include',
    description: 'Directs the executor to include this field or fragment only when the `if` argument is true.',
    locations: [
        DirectiveLocation.FIELD,
        DirectiveLocation.FRAGMENT_SPREAD,
        DirectiveLocation.INLINE_FRAGMENT
    ],
    args: {
        if: {
            type: GraphQLNonNull(GraphQLBoolean),
            description: 'Included when true.'
        }
    }
});
const GraphQLSkipDirective = new GraphQLDirective({
    name: 'skip',
    description: 'Directs the executor to skip this field or fragment when the `if` argument is true.',
    locations: [
        DirectiveLocation.FIELD,
        DirectiveLocation.FRAGMENT_SPREAD,
        DirectiveLocation.INLINE_FRAGMENT
    ],
    args: {
        if: {
            type: GraphQLNonNull(GraphQLBoolean),
            description: 'Skipped when true.'
        }
    }
});
const DEFAULT_DEPRECATION_REASON = 'No longer supported';
const GraphQLDeprecatedDirective = new GraphQLDirective({
    name: 'deprecated',
    description: 'Marks an element of a GraphQL schema as no longer supported.',
    locations: [
        DirectiveLocation.FIELD_DEFINITION,
        DirectiveLocation.ENUM_VALUE
    ],
    args: {
        reason: {
            type: GraphQLString,
            description: 'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).',
            defaultValue: DEFAULT_DEPRECATION_REASON
        }
    }
});
const specifiedDirectives = Object.freeze([
    GraphQLIncludeDirective,
    GraphQLSkipDirective,
    GraphQLDeprecatedDirective
]);
function isSpecifiedDirective(directive) {
    return specifiedDirectives.some(({ name  })=>name === directive.name);
}
const arrayFrom = Array.from || function(obj, mapFn, thisArg) {
    if (obj == null) {
        throw new TypeError('Array.from requires an array-like object - not null or undefined');
    }
    const iteratorMethod = obj[SYMBOL_ITERATOR];
    if (typeof iteratorMethod === 'function') {
        const iterator = iteratorMethod.call(obj);
        const result = [];
        let step;
        for(let i = 0; !(step = iterator.next()).done; ++i){
            result.push(mapFn.call(thisArg, step.value, i));
            if (i > 9999999) {
                throw new TypeError('Near-infinite iteration.');
            }
        }
        return result;
    }
    const length = obj.length;
    if (typeof length === 'number' && length >= 0 && length % 1 === 0) {
        const result1 = [];
        for(let i1 = 0; i1 < length; ++i1){
            if (Object.prototype.hasOwnProperty.call(obj, i1)) {
                result1.push(mapFn.call(thisArg, obj[i1], i1));
            }
        }
        return result1;
    }
    return [];
};
function isCollection(obj) {
    if (obj == null || typeof obj !== 'object') {
        return false;
    }
    const length = obj.length;
    if (typeof length === 'number' && length >= 0 && length % 1 === 0) {
        return true;
    }
    return typeof obj[SYMBOL_ITERATOR] === 'function';
}
function astFromValue(value, type) {
    if (isNonNullType(type)) {
        const astValue = astFromValue(value, type.ofType);
        if (astValue?.kind === Kind.NULL) {
            return null;
        }
        return astValue;
    }
    if (value === null) {
        return {
            kind: Kind.NULL
        };
    }
    if (value === undefined) {
        return null;
    }
    if (isListType(type)) {
        const itemType = type.ofType;
        if (isCollection(value)) {
            const valuesNodes = [];
            for (const item of arrayFrom(value)){
                const itemNode = astFromValue(item, itemType);
                if (itemNode != null) {
                    valuesNodes.push(itemNode);
                }
            }
            return {
                kind: Kind.LIST,
                values: valuesNodes
            };
        }
        return astFromValue(value, itemType);
    }
    if (isInputObjectType(type)) {
        if (!isObjectLike(value)) {
            return null;
        }
        const fieldNodes = [];
        for (const field of objectValues(type.getFields())){
            const fieldValue = astFromValue(value[field.name], field.type);
            if (fieldValue) {
                fieldNodes.push({
                    kind: Kind.OBJECT_FIELD,
                    name: {
                        kind: Kind.NAME,
                        value: field.name
                    },
                    value: fieldValue
                });
            }
        }
        return {
            kind: Kind.OBJECT,
            fields: fieldNodes
        };
    }
    if (isLeafType(type)) {
        const serialized = type.serialize(value);
        if (serialized == null) {
            return null;
        }
        if (typeof serialized === 'boolean') {
            return {
                kind: Kind.BOOLEAN,
                value: serialized
            };
        }
        if (typeof serialized === 'number' && isFinitePolyfill(serialized)) {
            const stringNum = String(serialized);
            return integerStringRegExp.test(stringNum) ? {
                kind: Kind.INT,
                value: stringNum
            } : {
                kind: Kind.FLOAT,
                value: stringNum
            };
        }
        if (typeof serialized === 'string') {
            if (isEnumType(type)) {
                return {
                    kind: Kind.ENUM,
                    value: serialized
                };
            }
            if (type === GraphQLID && integerStringRegExp.test(serialized)) {
                return {
                    kind: Kind.INT,
                    value: serialized
                };
            }
            return {
                kind: Kind.STRING,
                value: serialized
            };
        }
        throw new TypeError(`Cannot convert value to AST: ${inspect(serialized)}.`);
    }
    invariant(false, 'Unexpected input type: ' + inspect(type));
}
const integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;
const __Schema = new GraphQLObjectType({
    name: '__Schema',
    description: 'A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.',
    fields: ()=>({
            description: {
                type: GraphQLString,
                resolve: (schema)=>schema.description
            },
            types: {
                description: 'A list of all types supported by this server.',
                type: GraphQLNonNull(GraphQLList(GraphQLNonNull(__Type))),
                resolve (schema) {
                    return objectValues(schema.getTypeMap());
                }
            },
            queryType: {
                description: 'The type that query operations will be rooted at.',
                type: GraphQLNonNull(__Type),
                resolve: (schema)=>schema.getQueryType()
            },
            mutationType: {
                description: 'If this server supports mutation, the type that mutation operations will be rooted at.',
                type: __Type,
                resolve: (schema)=>schema.getMutationType()
            },
            subscriptionType: {
                description: 'If this server support subscription, the type that subscription operations will be rooted at.',
                type: __Type,
                resolve: (schema)=>schema.getSubscriptionType()
            },
            directives: {
                description: 'A list of all directives supported by this server.',
                type: GraphQLNonNull(GraphQLList(GraphQLNonNull(__Directive))),
                resolve: (schema)=>schema.getDirectives()
            }
        })
});
const __Directive = new GraphQLObjectType({
    name: '__Directive',
    description: "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
    fields: ()=>({
            name: {
                type: GraphQLNonNull(GraphQLString),
                resolve: (directive)=>directive.name
            },
            description: {
                type: GraphQLString,
                resolve: (directive)=>directive.description
            },
            isRepeatable: {
                type: GraphQLNonNull(GraphQLBoolean),
                resolve: (directive)=>directive.isRepeatable
            },
            locations: {
                type: GraphQLNonNull(GraphQLList(GraphQLNonNull(__DirectiveLocation))),
                resolve: (directive)=>directive.locations
            },
            args: {
                type: GraphQLNonNull(GraphQLList(GraphQLNonNull(__InputValue))),
                resolve: (directive)=>directive.args
            }
        })
});
const __DirectiveLocation = new GraphQLEnumType({
    name: '__DirectiveLocation',
    description: 'A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.',
    values: {
        QUERY: {
            value: DirectiveLocation.QUERY,
            description: 'Location adjacent to a query operation.'
        },
        MUTATION: {
            value: DirectiveLocation.MUTATION,
            description: 'Location adjacent to a mutation operation.'
        },
        SUBSCRIPTION: {
            value: DirectiveLocation.SUBSCRIPTION,
            description: 'Location adjacent to a subscription operation.'
        },
        FIELD: {
            value: DirectiveLocation.FIELD,
            description: 'Location adjacent to a field.'
        },
        FRAGMENT_DEFINITION: {
            value: DirectiveLocation.FRAGMENT_DEFINITION,
            description: 'Location adjacent to a fragment definition.'
        },
        FRAGMENT_SPREAD: {
            value: DirectiveLocation.FRAGMENT_SPREAD,
            description: 'Location adjacent to a fragment spread.'
        },
        INLINE_FRAGMENT: {
            value: DirectiveLocation.INLINE_FRAGMENT,
            description: 'Location adjacent to an inline fragment.'
        },
        VARIABLE_DEFINITION: {
            value: DirectiveLocation.VARIABLE_DEFINITION,
            description: 'Location adjacent to a variable definition.'
        },
        SCHEMA: {
            value: DirectiveLocation.SCHEMA,
            description: 'Location adjacent to a schema definition.'
        },
        SCALAR: {
            value: DirectiveLocation.SCALAR,
            description: 'Location adjacent to a scalar definition.'
        },
        OBJECT: {
            value: DirectiveLocation.OBJECT,
            description: 'Location adjacent to an object type definition.'
        },
        FIELD_DEFINITION: {
            value: DirectiveLocation.FIELD_DEFINITION,
            description: 'Location adjacent to a field definition.'
        },
        ARGUMENT_DEFINITION: {
            value: DirectiveLocation.ARGUMENT_DEFINITION,
            description: 'Location adjacent to an argument definition.'
        },
        INTERFACE: {
            value: DirectiveLocation.INTERFACE,
            description: 'Location adjacent to an interface definition.'
        },
        UNION: {
            value: DirectiveLocation.UNION,
            description: 'Location adjacent to a union definition.'
        },
        ENUM: {
            value: DirectiveLocation.ENUM,
            description: 'Location adjacent to an enum definition.'
        },
        ENUM_VALUE: {
            value: DirectiveLocation.ENUM_VALUE,
            description: 'Location adjacent to an enum value definition.'
        },
        INPUT_OBJECT: {
            value: DirectiveLocation.INPUT_OBJECT,
            description: 'Location adjacent to an input object type definition.'
        },
        INPUT_FIELD_DEFINITION: {
            value: DirectiveLocation.INPUT_FIELD_DEFINITION,
            description: 'Location adjacent to an input object field definition.'
        }
    }
});
const __Type = new GraphQLObjectType({
    name: '__Type',
    description: 'The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name and description, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.',
    fields: ()=>({
            kind: {
                type: GraphQLNonNull(__TypeKind),
                resolve (type) {
                    if (isScalarType(type)) {
                        return TypeKind.SCALAR;
                    }
                    if (isObjectType(type)) {
                        return TypeKind.OBJECT;
                    }
                    if (isInterfaceType(type)) {
                        return TypeKind.INTERFACE;
                    }
                    if (isUnionType(type)) {
                        return TypeKind.UNION;
                    }
                    if (isEnumType(type)) {
                        return TypeKind.ENUM;
                    }
                    if (isInputObjectType(type)) {
                        return TypeKind.INPUT_OBJECT;
                    }
                    if (isListType(type)) {
                        return TypeKind.LIST;
                    }
                    if (isNonNullType(type)) {
                        return TypeKind.NON_NULL;
                    }
                    invariant(false, `Unexpected type: "${inspect(type)}".`);
                }
            },
            name: {
                type: GraphQLString,
                resolve: (type)=>type.name !== undefined ? type.name : undefined
            },
            description: {
                type: GraphQLString,
                resolve: (type)=>type.description !== undefined ? type.description : undefined
            },
            fields: {
                type: GraphQLList(GraphQLNonNull(__Field)),
                args: {
                    includeDeprecated: {
                        type: GraphQLBoolean,
                        defaultValue: false
                    }
                },
                resolve (type, { includeDeprecated  }) {
                    if (isObjectType(type) || isInterfaceType(type)) {
                        let fields = objectValues(type.getFields());
                        if (!includeDeprecated) {
                            fields = fields.filter((field)=>!field.isDeprecated);
                        }
                        return fields;
                    }
                    return null;
                }
            },
            interfaces: {
                type: GraphQLList(GraphQLNonNull(__Type)),
                resolve (type) {
                    if (isObjectType(type) || isInterfaceType(type)) {
                        return type.getInterfaces();
                    }
                }
            },
            possibleTypes: {
                type: GraphQLList(GraphQLNonNull(__Type)),
                resolve (type, _args, _context, { schema  }) {
                    if (isAbstractType(type)) {
                        return schema.getPossibleTypes(type);
                    }
                }
            },
            enumValues: {
                type: GraphQLList(GraphQLNonNull(__EnumValue)),
                args: {
                    includeDeprecated: {
                        type: GraphQLBoolean,
                        defaultValue: false
                    }
                },
                resolve (type, { includeDeprecated  }) {
                    if (isEnumType(type)) {
                        let values = type.getValues();
                        if (!includeDeprecated) {
                            values = values.filter((value)=>!value.isDeprecated);
                        }
                        return values;
                    }
                }
            },
            inputFields: {
                type: GraphQLList(GraphQLNonNull(__InputValue)),
                resolve (type) {
                    if (isInputObjectType(type)) {
                        return objectValues(type.getFields());
                    }
                }
            },
            ofType: {
                type: __Type,
                resolve: (type)=>type.ofType !== undefined ? type.ofType : undefined
            }
        })
});
const __Field = new GraphQLObjectType({
    name: '__Field',
    description: 'Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.',
    fields: ()=>({
            name: {
                type: GraphQLNonNull(GraphQLString),
                resolve: (field)=>field.name
            },
            description: {
                type: GraphQLString,
                resolve: (field)=>field.description
            },
            args: {
                type: GraphQLNonNull(GraphQLList(GraphQLNonNull(__InputValue))),
                resolve: (field)=>field.args
            },
            type: {
                type: GraphQLNonNull(__Type),
                resolve: (field)=>field.type
            },
            isDeprecated: {
                type: GraphQLNonNull(GraphQLBoolean),
                resolve: (field)=>field.isDeprecated
            },
            deprecationReason: {
                type: GraphQLString,
                resolve: (field)=>field.deprecationReason
            }
        })
});
const __InputValue = new GraphQLObjectType({
    name: '__InputValue',
    description: 'Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.',
    fields: ()=>({
            name: {
                type: GraphQLNonNull(GraphQLString),
                resolve: (inputValue)=>inputValue.name
            },
            description: {
                type: GraphQLString,
                resolve: (inputValue)=>inputValue.description
            },
            type: {
                type: GraphQLNonNull(__Type),
                resolve: (inputValue)=>inputValue.type
            },
            defaultValue: {
                type: GraphQLString,
                description: 'A GraphQL-formatted string representing the default value for this input value.',
                resolve (inputValue) {
                    const { type , defaultValue  } = inputValue;
                    const valueAST = astFromValue(defaultValue, type);
                    return valueAST ? print(valueAST) : null;
                }
            }
        })
});
const __EnumValue = new GraphQLObjectType({
    name: '__EnumValue',
    description: 'One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.',
    fields: ()=>({
            name: {
                type: GraphQLNonNull(GraphQLString),
                resolve: (enumValue)=>enumValue.name
            },
            description: {
                type: GraphQLString,
                resolve: (enumValue)=>enumValue.description
            },
            isDeprecated: {
                type: GraphQLNonNull(GraphQLBoolean),
                resolve: (enumValue)=>enumValue.isDeprecated
            },
            deprecationReason: {
                type: GraphQLString,
                resolve: (enumValue)=>enumValue.deprecationReason
            }
        })
});
const TypeKind = Object.freeze({
    SCALAR: 'SCALAR',
    OBJECT: 'OBJECT',
    INTERFACE: 'INTERFACE',
    UNION: 'UNION',
    ENUM: 'ENUM',
    INPUT_OBJECT: 'INPUT_OBJECT',
    LIST: 'LIST',
    NON_NULL: 'NON_NULL'
});
const __TypeKind = new GraphQLEnumType({
    name: '__TypeKind',
    description: 'An enum describing what kind of type a given `__Type` is.',
    values: {
        SCALAR: {
            value: TypeKind.SCALAR,
            description: 'Indicates this type is a scalar.'
        },
        OBJECT: {
            value: TypeKind.OBJECT,
            description: 'Indicates this type is an object. `fields` and `interfaces` are valid fields.'
        },
        INTERFACE: {
            value: TypeKind.INTERFACE,
            description: 'Indicates this type is an interface. `fields`, `interfaces`, and `possibleTypes` are valid fields.'
        },
        UNION: {
            value: TypeKind.UNION,
            description: 'Indicates this type is a union. `possibleTypes` is a valid field.'
        },
        ENUM: {
            value: TypeKind.ENUM,
            description: 'Indicates this type is an enum. `enumValues` is a valid field.'
        },
        INPUT_OBJECT: {
            value: TypeKind.INPUT_OBJECT,
            description: 'Indicates this type is an input object. `inputFields` is a valid field.'
        },
        LIST: {
            value: TypeKind.LIST,
            description: 'Indicates this type is a list. `ofType` is a valid field.'
        },
        NON_NULL: {
            value: TypeKind.NON_NULL,
            description: 'Indicates this type is a non-null. `ofType` is a valid field.'
        }
    }
});
const SchemaMetaFieldDef = {
    name: '__schema',
    type: GraphQLNonNull(__Schema),
    description: 'Access the current type schema of this server.',
    args: [],
    resolve: (_source, _args, _context, { schema  })=>schema,
    isDeprecated: false,
    deprecationReason: undefined,
    extensions: undefined,
    astNode: undefined
};
const TypeMetaFieldDef = {
    name: '__type',
    type: __Type,
    description: 'Request the type information of a single type.',
    args: [
        {
            name: 'name',
            description: undefined,
            type: GraphQLNonNull(GraphQLString),
            defaultValue: undefined,
            extensions: undefined,
            astNode: undefined
        }
    ],
    resolve: (_source, { name  }, _context, { schema  })=>schema.getType(name),
    isDeprecated: false,
    deprecationReason: undefined,
    extensions: undefined,
    astNode: undefined
};
const TypeNameMetaFieldDef = {
    name: '__typename',
    type: GraphQLNonNull(GraphQLString),
    description: 'The name of the current Object type at runtime.',
    args: [],
    resolve: (_source, _args, _context, { parentType  })=>parentType.name,
    isDeprecated: false,
    deprecationReason: undefined,
    extensions: undefined,
    astNode: undefined
};
const introspectionTypes = Object.freeze([
    __Schema,
    __Directive,
    __DirectiveLocation,
    __Type,
    __Field,
    __InputValue,
    __EnumValue,
    __TypeKind
]);
function isIntrospectionType(type) {
    return introspectionTypes.some(({ name  })=>type.name === name);
}
function isSchema(schema) {
    return __default1(schema, GraphQLSchema);
}
function assertSchema(schema) {
    if (!isSchema(schema)) {
        throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
    }
    return schema;
}
class GraphQLSchema {
    constructor(config){
        this.__validationErrors = config.assumeValid === true ? [] : undefined;
        devAssert(isObjectLike(config), 'Must provide configuration object.');
        devAssert(!config.types || Array.isArray(config.types), `"types" must be Array if provided but got: ${inspect(config.types)}.`);
        devAssert(!config.directives || Array.isArray(config.directives), '"directives" must be Array if provided but got: ' + `${inspect(config.directives)}.`);
        this.description = config.description;
        this.extensions = config.extensions && toObjMap(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes;
        this._queryType = config.query;
        this._mutationType = config.mutation;
        this._subscriptionType = config.subscription;
        this._directives = config.directives ?? specifiedDirectives;
        const allReferencedTypes = new Set(config.types);
        if (config.types != null) {
            for (const type of config.types){
                allReferencedTypes.delete(type);
                collectReferencedTypes(type, allReferencedTypes);
            }
        }
        if (this._queryType != null) {
            collectReferencedTypes(this._queryType, allReferencedTypes);
        }
        if (this._mutationType != null) {
            collectReferencedTypes(this._mutationType, allReferencedTypes);
        }
        if (this._subscriptionType != null) {
            collectReferencedTypes(this._subscriptionType, allReferencedTypes);
        }
        for (const directive of this._directives){
            if (isDirective(directive)) {
                for (const arg of directive.args){
                    collectReferencedTypes(arg.type, allReferencedTypes);
                }
            }
        }
        collectReferencedTypes(__Schema, allReferencedTypes);
        this._typeMap = Object.create(null);
        this._subTypeMap = Object.create(null);
        this._implementationsMap = Object.create(null);
        for (const namedType of arrayFrom(allReferencedTypes)){
            if (namedType == null) {
                continue;
            }
            const typeName = namedType.name;
            devAssert(typeName, 'One of the provided types for building the Schema is missing a name.');
            if (this._typeMap[typeName] !== undefined) {
                throw new Error(`Schema must contain uniquely named types but contains multiple types named "${typeName}".`);
            }
            this._typeMap[typeName] = namedType;
            if (isInterfaceType(namedType)) {
                for (const iface of namedType.getInterfaces()){
                    if (isInterfaceType(iface)) {
                        let implementations = this._implementationsMap[iface.name];
                        if (implementations === undefined) {
                            implementations = this._implementationsMap[iface.name] = {
                                objects: [],
                                interfaces: []
                            };
                        }
                        implementations.interfaces.push(namedType);
                    }
                }
            } else if (isObjectType(namedType)) {
                for (const iface1 of namedType.getInterfaces()){
                    if (isInterfaceType(iface1)) {
                        let implementations1 = this._implementationsMap[iface1.name];
                        if (implementations1 === undefined) {
                            implementations1 = this._implementationsMap[iface1.name] = {
                                objects: [],
                                interfaces: []
                            };
                        }
                        implementations1.objects.push(namedType);
                    }
                }
            }
        }
    }
    getQueryType() {
        return this._queryType;
    }
    getMutationType() {
        return this._mutationType;
    }
    getSubscriptionType() {
        return this._subscriptionType;
    }
    getTypeMap() {
        return this._typeMap;
    }
    getType(name) {
        return this.getTypeMap()[name];
    }
    getPossibleTypes(abstractType) {
        return isUnionType(abstractType) ? abstractType.getTypes() : this.getImplementations(abstractType).objects;
    }
    getImplementations(interfaceType) {
        const implementations = this._implementationsMap[interfaceType.name];
        return implementations ?? {
            objects: [],
            interfaces: []
        };
    }
    isPossibleType(abstractType, possibleType) {
        return this.isSubType(abstractType, possibleType);
    }
    isSubType(abstractType, maybeSubType) {
        let map = this._subTypeMap[abstractType.name];
        if (map === undefined) {
            map = Object.create(null);
            if (isUnionType(abstractType)) {
                for (const type of abstractType.getTypes()){
                    map[type.name] = true;
                }
            } else {
                const implementations = this.getImplementations(abstractType);
                for (const type1 of implementations.objects){
                    map[type1.name] = true;
                }
                for (const type2 of implementations.interfaces){
                    map[type2.name] = true;
                }
            }
            this._subTypeMap[abstractType.name] = map;
        }
        return map[maybeSubType.name] !== undefined;
    }
    getDirectives() {
        return this._directives;
    }
    getDirective(name) {
        return find(this.getDirectives(), (directive)=>directive.name === name);
    }
    toConfig() {
        return {
            description: this.description,
            query: this.getQueryType(),
            mutation: this.getMutationType(),
            subscription: this.getSubscriptionType(),
            types: objectValues(this.getTypeMap()),
            directives: this.getDirectives().slice(),
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes ?? [],
            assumeValid: this.__validationErrors !== undefined
        };
    }
    get [SYMBOL_TO_STRING_TAG]() {
        return 'GraphQLSchema';
    }
}
function collectReferencedTypes(type, typeSet) {
    const namedType = getNamedType(type);
    if (!typeSet.has(namedType)) {
        typeSet.add(namedType);
        if (isUnionType(namedType)) {
            for (const memberType of namedType.getTypes()){
                collectReferencedTypes(memberType, typeSet);
            }
        } else if (isObjectType(namedType) || isInterfaceType(namedType)) {
            for (const interfaceType of namedType.getInterfaces()){
                collectReferencedTypes(interfaceType, typeSet);
            }
            for (const field of objectValues(namedType.getFields())){
                collectReferencedTypes(field.type, typeSet);
                for (const arg of field.args){
                    collectReferencedTypes(arg.type, typeSet);
                }
            }
        } else if (isInputObjectType(namedType)) {
            for (const field1 of objectValues(namedType.getFields())){
                collectReferencedTypes(field1.type, typeSet);
            }
        }
    }
    return typeSet;
}
function validateSchema(schema) {
    assertSchema(schema);
    if (schema.__validationErrors) {
        return schema.__validationErrors;
    }
    const context = new SchemaValidationContext(schema);
    validateRootTypes(context);
    validateDirectives(context);
    validateTypes(context);
    const errors = context.getErrors();
    schema.__validationErrors = errors;
    return errors;
}
function assertValidSchema(schema) {
    const errors = validateSchema(schema);
    if (errors.length !== 0) {
        throw new Error(errors.map((error)=>error.message).join('\n\n'));
    }
}
class SchemaValidationContext {
    constructor(schema){
        this._errors = [];
        this.schema = schema;
    }
    reportError(message, nodes) {
        const _nodes = Array.isArray(nodes) ? nodes.filter(Boolean) : nodes;
        this.addError(new GraphQLError(message, _nodes));
    }
    addError(error) {
        this._errors.push(error);
    }
    getErrors() {
        return this._errors;
    }
}
function validateRootTypes(context) {
    const schema = context.schema;
    const queryType = schema.getQueryType();
    if (!queryType) {
        context.reportError('Query root type must be provided.', schema.astNode);
    } else if (!isObjectType(queryType)) {
        context.reportError(`Query root type must be Object type, it cannot be ${inspect(queryType)}.`, getOperationTypeNode(schema, queryType, 'query'));
    }
    const mutationType = schema.getMutationType();
    if (mutationType && !isObjectType(mutationType)) {
        context.reportError('Mutation root type must be Object type if provided, it cannot be ' + `${inspect(mutationType)}.`, getOperationTypeNode(schema, mutationType, 'mutation'));
    }
    const subscriptionType = schema.getSubscriptionType();
    if (subscriptionType && !isObjectType(subscriptionType)) {
        context.reportError('Subscription root type must be Object type if provided, it cannot be ' + `${inspect(subscriptionType)}.`, getOperationTypeNode(schema, subscriptionType, 'subscription'));
    }
}
function getOperationTypeNode(schema, type, operation) {
    const operationNodes = getAllSubNodes(schema, (node)=>node.operationTypes);
    for (const node of operationNodes){
        if (node.operation === operation) {
            return node.type;
        }
    }
    return type.astNode;
}
function validateDirectives(context) {
    for (const directive of context.schema.getDirectives()){
        if (!isDirective(directive)) {
            context.reportError(`Expected directive but got: ${inspect(directive)}.`, directive?.astNode);
            continue;
        }
        validateName(context, directive);
        for (const arg of directive.args){
            validateName(context, arg);
            if (!isInputType(arg.type)) {
                context.reportError(`The type of @${directive.name}(${arg.name}:) must be Input Type ` + `but got: ${inspect(arg.type)}.`, arg.astNode);
            }
        }
    }
}
function validateName(context, node) {
    const error = isValidNameError(node.name);
    if (error) {
        context.addError(locatedError(error, node.astNode));
    }
}
function validateTypes(context) {
    const validateInputObjectCircularRefs = createInputObjectCircularRefsValidator(context);
    const typeMap = context.schema.getTypeMap();
    for (const type of objectValues(typeMap)){
        if (!isNamedType(type)) {
            context.reportError(`Expected GraphQL named type but got: ${inspect(type)}.`, type.astNode);
            continue;
        }
        if (!isIntrospectionType(type)) {
            validateName(context, type);
        }
        if (isObjectType(type)) {
            validateFields(context, type);
            validateInterfaces(context, type);
        } else if (isInterfaceType(type)) {
            validateFields(context, type);
            validateInterfaces(context, type);
        } else if (isUnionType(type)) {
            validateUnionMembers(context, type);
        } else if (isEnumType(type)) {
            validateEnumValues(context, type);
        } else if (isInputObjectType(type)) {
            validateInputFields(context, type);
            validateInputObjectCircularRefs(type);
        }
    }
}
function validateFields(context, type) {
    const fields = objectValues(type.getFields());
    if (fields.length === 0) {
        context.reportError(`Type ${type.name} must define one or more fields.`, getAllNodes(type));
    }
    for (const field of fields){
        validateName(context, field);
        if (!isOutputType(field.type)) {
            context.reportError(`The type of ${type.name}.${field.name} must be Output Type ` + `but got: ${inspect(field.type)}.`, field.astNode?.type);
        }
        for (const arg of field.args){
            const argName = arg.name;
            validateName(context, arg);
            if (!isInputType(arg.type)) {
                context.reportError(`The type of ${type.name}.${field.name}(${argName}:) must be Input ` + `Type but got: ${inspect(arg.type)}.`, arg.astNode?.type);
            }
        }
    }
}
function validateInterfaces(context, type) {
    const ifaceTypeNames = Object.create(null);
    for (const iface of type.getInterfaces()){
        if (!isInterfaceType(iface)) {
            context.reportError(`Type ${inspect(type)} must only implement Interface types, ` + `it cannot implement ${inspect(iface)}.`, getAllImplementsInterfaceNodes(type, iface));
            continue;
        }
        if (type === iface) {
            context.reportError(`Type ${type.name} cannot implement itself because it would create a circular reference.`, getAllImplementsInterfaceNodes(type, iface));
            continue;
        }
        if (ifaceTypeNames[iface.name]) {
            context.reportError(`Type ${type.name} can only implement ${iface.name} once.`, getAllImplementsInterfaceNodes(type, iface));
            continue;
        }
        ifaceTypeNames[iface.name] = true;
        validateTypeImplementsAncestors(context, type, iface);
        validateTypeImplementsInterface(context, type, iface);
    }
}
function validateTypeImplementsInterface(context, type, iface) {
    const typeFieldMap = type.getFields();
    for (const ifaceField of objectValues(iface.getFields())){
        const fieldName = ifaceField.name;
        const typeField = typeFieldMap[fieldName];
        if (!typeField) {
            context.reportError(`Interface field ${iface.name}.${fieldName} expected but ${type.name} does not provide it.`, [
                ifaceField.astNode,
                ...getAllNodes(type)
            ]);
            continue;
        }
        if (!isTypeSubTypeOf(context.schema, typeField.type, ifaceField.type)) {
            context.reportError(`Interface field ${iface.name}.${fieldName} expects type ` + `${inspect(ifaceField.type)} but ${type.name}.${fieldName} ` + `is type ${inspect(typeField.type)}.`, [
                ifaceField.astNode.type,
                typeField.astNode.type
            ]);
        }
        for (const ifaceArg of ifaceField.args){
            const argName = ifaceArg.name;
            const typeArg = find(typeField.args, (arg)=>arg.name === argName);
            if (!typeArg) {
                context.reportError(`Interface field argument ${iface.name}.${fieldName}(${argName}:) expected but ${type.name}.${fieldName} does not provide it.`, [
                    ifaceArg.astNode,
                    typeField.astNode
                ]);
                continue;
            }
            if (!isEqualType(ifaceArg.type, typeArg.type)) {
                context.reportError(`Interface field argument ${iface.name}.${fieldName}(${argName}:) ` + `expects type ${inspect(ifaceArg.type)} but ` + `${type.name}.${fieldName}(${argName}:) is type ` + `${inspect(typeArg.type)}.`, [
                    ifaceArg.astNode.type,
                    typeArg.astNode.type
                ]);
            }
        }
        for (const typeArg1 of typeField.args){
            const argName1 = typeArg1.name;
            const ifaceArg1 = find(ifaceField.args, (arg)=>arg.name === argName1);
            if (!ifaceArg1 && isRequiredArgument(typeArg1)) {
                context.reportError(`Object field ${type.name}.${fieldName} includes required argument ${argName1} that is missing from the Interface field ${iface.name}.${fieldName}.`, [
                    typeArg1.astNode,
                    ifaceField.astNode
                ]);
            }
        }
    }
}
function validateTypeImplementsAncestors(context, type, iface) {
    const ifaceInterfaces = type.getInterfaces();
    for (const transitive of iface.getInterfaces()){
        if (ifaceInterfaces.indexOf(transitive) === -1) {
            context.reportError(transitive === type ? `Type ${type.name} cannot implement ${iface.name} because it would create a circular reference.` : `Type ${type.name} must implement ${transitive.name} because it is implemented by ${iface.name}.`, [
                ...getAllImplementsInterfaceNodes(iface, transitive),
                ...getAllImplementsInterfaceNodes(type, iface)
            ]);
        }
    }
}
function validateUnionMembers(context, union) {
    const memberTypes = union.getTypes();
    if (memberTypes.length === 0) {
        context.reportError(`Union type ${union.name} must define one or more member types.`, getAllNodes(union));
    }
    const includedTypeNames = Object.create(null);
    for (const memberType of memberTypes){
        if (includedTypeNames[memberType.name]) {
            context.reportError(`Union type ${union.name} can only include type ${memberType.name} once.`, getUnionMemberTypeNodes(union, memberType.name));
            continue;
        }
        includedTypeNames[memberType.name] = true;
        if (!isObjectType(memberType)) {
            context.reportError(`Union type ${union.name} can only include Object types, ` + `it cannot include ${inspect(memberType)}.`, getUnionMemberTypeNodes(union, String(memberType)));
        }
    }
}
function validateEnumValues(context, enumType) {
    const enumValues = enumType.getValues();
    if (enumValues.length === 0) {
        context.reportError(`Enum type ${enumType.name} must define one or more values.`, getAllNodes(enumType));
    }
    for (const enumValue of enumValues){
        const valueName = enumValue.name;
        validateName(context, enumValue);
        if (valueName === 'true' || valueName === 'false' || valueName === 'null') {
            context.reportError(`Enum type ${enumType.name} cannot include value: ${valueName}.`, enumValue.astNode);
        }
    }
}
function validateInputFields(context, inputObj) {
    const fields = objectValues(inputObj.getFields());
    if (fields.length === 0) {
        context.reportError(`Input Object type ${inputObj.name} must define one or more fields.`, getAllNodes(inputObj));
    }
    for (const field of fields){
        validateName(context, field);
        if (!isInputType(field.type)) {
            context.reportError(`The type of ${inputObj.name}.${field.name} must be Input Type ` + `but got: ${inspect(field.type)}.`, field.astNode?.type);
        }
    }
}
function createInputObjectCircularRefsValidator(context) {
    const visitedTypes = Object.create(null);
    const fieldPath = [];
    const fieldPathIndexByTypeName = Object.create(null);
    return detectCycleRecursive;
    function detectCycleRecursive(inputObj) {
        if (visitedTypes[inputObj.name]) {
            return;
        }
        visitedTypes[inputObj.name] = true;
        fieldPathIndexByTypeName[inputObj.name] = fieldPath.length;
        const fields = objectValues(inputObj.getFields());
        for (const field of fields){
            if (isNonNullType(field.type) && isInputObjectType(field.type.ofType)) {
                const fieldType = field.type.ofType;
                const cycleIndex = fieldPathIndexByTypeName[fieldType.name];
                fieldPath.push(field);
                if (cycleIndex === undefined) {
                    detectCycleRecursive(fieldType);
                } else {
                    const cyclePath = fieldPath.slice(cycleIndex);
                    const pathStr = cyclePath.map((fieldObj)=>fieldObj.name).join('.');
                    context.reportError(`Cannot reference Input Object "${fieldType.name}" within itself through a series of non-null fields: "${pathStr}".`, cyclePath.map((fieldObj)=>fieldObj.astNode));
                }
                fieldPath.pop();
            }
        }
        fieldPathIndexByTypeName[inputObj.name] = undefined;
    }
}
function getAllNodes(object) {
    const { astNode , extensionASTNodes  } = object;
    return astNode ? extensionASTNodes ? [
        astNode
    ].concat(extensionASTNodes) : [
        astNode
    ] : extensionASTNodes ?? [];
}
function getAllSubNodes(object, getter) {
    return flatMap(getAllNodes(object), (item)=>getter(item) ?? []);
}
function getAllImplementsInterfaceNodes(type, iface) {
    return getAllSubNodes(type, (typeNode)=>typeNode.interfaces).filter((ifaceNode)=>ifaceNode.name.value === iface.name);
}
function getUnionMemberTypeNodes(union, typeName) {
    return getAllSubNodes(union, (unionNode)=>unionNode.types).filter((typeNode)=>typeNode.name.value === typeName);
}
function typeFromAST(schema, typeNode) {
    let innerType;
    if (typeNode.kind === Kind.LIST_TYPE) {
        innerType = typeFromAST(schema, typeNode.type);
        return innerType && GraphQLList(innerType);
    }
    if (typeNode.kind === Kind.NON_NULL_TYPE) {
        innerType = typeFromAST(schema, typeNode.type);
        return innerType && GraphQLNonNull(innerType);
    }
    if (typeNode.kind === Kind.NAMED_TYPE) {
        return schema.getType(typeNode.name.value);
    }
    invariant(false, 'Unexpected type node: ' + inspect(typeNode));
}
class TypeInfo {
    constructor(schema, getFieldDefFn, initialType){
        this._schema = schema;
        this._typeStack = [];
        this._parentTypeStack = [];
        this._inputTypeStack = [];
        this._fieldDefStack = [];
        this._defaultValueStack = [];
        this._directive = null;
        this._argument = null;
        this._enumValue = null;
        this._getFieldDef = getFieldDefFn ?? getFieldDef;
        if (initialType) {
            if (isInputType(initialType)) {
                this._inputTypeStack.push(initialType);
            }
            if (isCompositeType(initialType)) {
                this._parentTypeStack.push(initialType);
            }
            if (isOutputType(initialType)) {
                this._typeStack.push(initialType);
            }
        }
    }
    getType() {
        if (this._typeStack.length > 0) {
            return this._typeStack[this._typeStack.length - 1];
        }
    }
    getParentType() {
        if (this._parentTypeStack.length > 0) {
            return this._parentTypeStack[this._parentTypeStack.length - 1];
        }
    }
    getInputType() {
        if (this._inputTypeStack.length > 0) {
            return this._inputTypeStack[this._inputTypeStack.length - 1];
        }
    }
    getParentInputType() {
        if (this._inputTypeStack.length > 1) {
            return this._inputTypeStack[this._inputTypeStack.length - 2];
        }
    }
    getFieldDef() {
        if (this._fieldDefStack.length > 0) {
            return this._fieldDefStack[this._fieldDefStack.length - 1];
        }
    }
    getDefaultValue() {
        if (this._defaultValueStack.length > 0) {
            return this._defaultValueStack[this._defaultValueStack.length - 1];
        }
    }
    getDirective() {
        return this._directive;
    }
    getArgument() {
        return this._argument;
    }
    getEnumValue() {
        return this._enumValue;
    }
    enter(node) {
        const schema = this._schema;
        switch(node.kind){
            case Kind.SELECTION_SET:
                {
                    const namedType = getNamedType(this.getType());
                    this._parentTypeStack.push(isCompositeType(namedType) ? namedType : undefined);
                    break;
                }
            case Kind.FIELD:
                {
                    const parentType = this.getParentType();
                    let fieldDef;
                    let fieldType;
                    if (parentType) {
                        fieldDef = this._getFieldDef(schema, parentType, node);
                        if (fieldDef) {
                            fieldType = fieldDef.type;
                        }
                    }
                    this._fieldDefStack.push(fieldDef);
                    this._typeStack.push(isOutputType(fieldType) ? fieldType : undefined);
                    break;
                }
            case Kind.DIRECTIVE:
                this._directive = schema.getDirective(node.name.value);
                break;
            case Kind.OPERATION_DEFINITION:
                {
                    let type;
                    switch(node.operation){
                        case 'query':
                            type = schema.getQueryType();
                            break;
                        case 'mutation':
                            type = schema.getMutationType();
                            break;
                        case 'subscription':
                            type = schema.getSubscriptionType();
                            break;
                    }
                    this._typeStack.push(isObjectType(type) ? type : undefined);
                    break;
                }
            case Kind.INLINE_FRAGMENT:
            case Kind.FRAGMENT_DEFINITION:
                {
                    const typeConditionAST = node.typeCondition;
                    const outputType = typeConditionAST ? typeFromAST(schema, typeConditionAST) : getNamedType(this.getType());
                    this._typeStack.push(isOutputType(outputType) ? outputType : undefined);
                    break;
                }
            case Kind.VARIABLE_DEFINITION:
                {
                    const inputType = typeFromAST(schema, node.type);
                    this._inputTypeStack.push(isInputType(inputType) ? inputType : undefined);
                    break;
                }
            case Kind.ARGUMENT:
                {
                    let argDef;
                    let argType;
                    const fieldOrDirective = this.getDirective() ?? this.getFieldDef();
                    if (fieldOrDirective) {
                        argDef = find(fieldOrDirective.args, (arg)=>arg.name === node.name.value);
                        if (argDef) {
                            argType = argDef.type;
                        }
                    }
                    this._argument = argDef;
                    this._defaultValueStack.push(argDef ? argDef.defaultValue : undefined);
                    this._inputTypeStack.push(isInputType(argType) ? argType : undefined);
                    break;
                }
            case Kind.LIST:
                {
                    const listType = getNullableType(this.getInputType());
                    const itemType = isListType(listType) ? listType.ofType : listType;
                    this._defaultValueStack.push(undefined);
                    this._inputTypeStack.push(isInputType(itemType) ? itemType : undefined);
                    break;
                }
            case Kind.OBJECT_FIELD:
                {
                    const objectType = getNamedType(this.getInputType());
                    let inputFieldType;
                    let inputField;
                    if (isInputObjectType(objectType)) {
                        inputField = objectType.getFields()[node.name.value];
                        if (inputField) {
                            inputFieldType = inputField.type;
                        }
                    }
                    this._defaultValueStack.push(inputField ? inputField.defaultValue : undefined);
                    this._inputTypeStack.push(isInputType(inputFieldType) ? inputFieldType : undefined);
                    break;
                }
            case Kind.ENUM:
                {
                    const enumType = getNamedType(this.getInputType());
                    let enumValue;
                    if (isEnumType(enumType)) {
                        enumValue = enumType.getValue(node.value);
                    }
                    this._enumValue = enumValue;
                    break;
                }
        }
    }
    leave(node) {
        switch(node.kind){
            case Kind.SELECTION_SET:
                this._parentTypeStack.pop();
                break;
            case Kind.FIELD:
                this._fieldDefStack.pop();
                this._typeStack.pop();
                break;
            case Kind.DIRECTIVE:
                this._directive = null;
                break;
            case Kind.OPERATION_DEFINITION:
            case Kind.INLINE_FRAGMENT:
            case Kind.FRAGMENT_DEFINITION:
                this._typeStack.pop();
                break;
            case Kind.VARIABLE_DEFINITION:
                this._inputTypeStack.pop();
                break;
            case Kind.ARGUMENT:
                this._argument = null;
                this._defaultValueStack.pop();
                this._inputTypeStack.pop();
                break;
            case Kind.LIST:
            case Kind.OBJECT_FIELD:
                this._defaultValueStack.pop();
                this._inputTypeStack.pop();
                break;
            case Kind.ENUM:
                this._enumValue = null;
                break;
        }
    }
}
function getFieldDef(schema, parentType, fieldNode) {
    const name = fieldNode.name.value;
    if (name === SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
        return SchemaMetaFieldDef;
    }
    if (name === TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
        return TypeMetaFieldDef;
    }
    if (name === TypeNameMetaFieldDef.name && isCompositeType(parentType)) {
        return TypeNameMetaFieldDef;
    }
    if (isObjectType(parentType) || isInterfaceType(parentType)) {
        return parentType.getFields()[name];
    }
}
function visitWithTypeInfo(typeInfo, visitor) {
    return {
        enter (node) {
            typeInfo.enter(node);
            const fn = getVisitFn(visitor, node.kind, false);
            if (fn) {
                const result = fn.apply(visitor, arguments);
                if (result !== undefined) {
                    typeInfo.leave(node);
                    if (isNode(result)) {
                        typeInfo.enter(result);
                    }
                }
                return result;
            }
        },
        leave (node) {
            const fn = getVisitFn(visitor, node.kind, true);
            let result;
            if (fn) {
                result = fn.apply(visitor, arguments);
            }
            typeInfo.leave(node);
            return result;
        }
    };
}
function isDefinitionNode(node) {
    return isExecutableDefinitionNode(node) || isTypeSystemDefinitionNode(node) || isTypeSystemExtensionNode(node);
}
function isExecutableDefinitionNode(node) {
    return node.kind === Kind.OPERATION_DEFINITION || node.kind === Kind.FRAGMENT_DEFINITION;
}
function isSelectionNode(node) {
    return node.kind === Kind.FIELD || node.kind === Kind.FRAGMENT_SPREAD || node.kind === Kind.INLINE_FRAGMENT;
}
function isValueNode(node) {
    return node.kind === Kind.VARIABLE || node.kind === Kind.INT || node.kind === Kind.FLOAT || node.kind === Kind.STRING || node.kind === Kind.BOOLEAN || node.kind === Kind.NULL || node.kind === Kind.ENUM || node.kind === Kind.LIST || node.kind === Kind.OBJECT;
}
function isTypeNode(node) {
    return node.kind === Kind.NAMED_TYPE || node.kind === Kind.LIST_TYPE || node.kind === Kind.NON_NULL_TYPE;
}
function isTypeSystemDefinitionNode(node) {
    return node.kind === Kind.SCHEMA_DEFINITION || isTypeDefinitionNode(node) || node.kind === Kind.DIRECTIVE_DEFINITION;
}
function isTypeDefinitionNode(node) {
    return node.kind === Kind.SCALAR_TYPE_DEFINITION || node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.INTERFACE_TYPE_DEFINITION || node.kind === Kind.UNION_TYPE_DEFINITION || node.kind === Kind.ENUM_TYPE_DEFINITION || node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION;
}
function isTypeSystemExtensionNode(node) {
    return node.kind === Kind.SCHEMA_EXTENSION || isTypeExtensionNode(node);
}
function isTypeExtensionNode(node) {
    return node.kind === Kind.SCALAR_TYPE_EXTENSION || node.kind === Kind.OBJECT_TYPE_EXTENSION || node.kind === Kind.INTERFACE_TYPE_EXTENSION || node.kind === Kind.UNION_TYPE_EXTENSION || node.kind === Kind.ENUM_TYPE_EXTENSION || node.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION;
}
function ExecutableDefinitionsRule(context) {
    return {
        Document (node) {
            for (const definition of node.definitions){
                if (!isExecutableDefinitionNode(definition)) {
                    const defName = definition.kind === Kind.SCHEMA_DEFINITION || definition.kind === Kind.SCHEMA_EXTENSION ? 'schema' : '"' + definition.name.value + '"';
                    context.reportError(new GraphQLError(`The ${defName} definition is not executable.`, definition));
                }
            }
            return false;
        }
    };
}
function UniqueOperationNamesRule(context) {
    const knownOperationNames = Object.create(null);
    return {
        OperationDefinition (node) {
            const operationName = node.name;
            if (operationName) {
                if (knownOperationNames[operationName.value]) {
                    context.reportError(new GraphQLError(`There can be only one operation named "${operationName.value}".`, [
                        knownOperationNames[operationName.value],
                        operationName
                    ]));
                } else {
                    knownOperationNames[operationName.value] = operationName;
                }
            }
            return false;
        },
        FragmentDefinition: ()=>false
    };
}
function LoneAnonymousOperationRule(context) {
    let operationCount = 0;
    return {
        Document (node) {
            operationCount = node.definitions.filter((definition)=>definition.kind === Kind.OPERATION_DEFINITION).length;
        },
        OperationDefinition (node) {
            if (!node.name && operationCount > 1) {
                context.reportError(new GraphQLError('This anonymous operation must be the only defined operation.', node));
            }
        }
    };
}
function SingleFieldSubscriptionsRule(context) {
    return {
        OperationDefinition (node) {
            if (node.operation === 'subscription') {
                if (node.selectionSet.selections.length !== 1) {
                    context.reportError(new GraphQLError(node.name ? `Subscription "${node.name.value}" must select only one top level field.` : 'Anonymous Subscription must select only one top level field.', node.selectionSet.selections.slice(1)));
                }
            }
        }
    };
}
function KnownTypeNamesRule(context) {
    const schema = context.getSchema();
    const existingTypesMap = schema ? schema.getTypeMap() : Object.create(null);
    const definedTypes = Object.create(null);
    for (const def of context.getDocument().definitions){
        if (isTypeDefinitionNode(def)) {
            definedTypes[def.name.value] = true;
        }
    }
    const typeNames = Object.keys(existingTypesMap).concat(Object.keys(definedTypes));
    return {
        NamedType (node, _1, parent, _2, ancestors) {
            const typeName = node.name.value;
            if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
                const definitionNode = ancestors[2] ?? parent;
                const isSDL = definitionNode != null && isSDLNode(definitionNode);
                if (isSDL && isSpecifiedScalarName(typeName)) {
                    return;
                }
                const suggestedTypes = suggestionList(typeName, isSDL ? specifiedScalarsNames.concat(typeNames) : typeNames);
                context.reportError(new GraphQLError(`Unknown type "${typeName}".` + didYouMean(suggestedTypes), node));
            }
        }
    };
}
const specifiedScalarsNames = specifiedScalarTypes.map((type)=>type.name);
function isSpecifiedScalarName(typeName) {
    return specifiedScalarsNames.indexOf(typeName) !== -1;
}
function isSDLNode(value) {
    return !Array.isArray(value) && (isTypeSystemDefinitionNode(value) || isTypeSystemExtensionNode(value));
}
function FragmentsOnCompositeTypesRule(context) {
    return {
        InlineFragment (node) {
            const typeCondition = node.typeCondition;
            if (typeCondition) {
                const type = typeFromAST(context.getSchema(), typeCondition);
                if (type && !isCompositeType(type)) {
                    const typeStr = print(typeCondition);
                    context.reportError(new GraphQLError(`Fragment cannot condition on non composite type "${typeStr}".`, typeCondition));
                }
            }
        },
        FragmentDefinition (node) {
            const type = typeFromAST(context.getSchema(), node.typeCondition);
            if (type && !isCompositeType(type)) {
                const typeStr = print(node.typeCondition);
                context.reportError(new GraphQLError(`Fragment "${node.name.value}" cannot condition on non composite type "${typeStr}".`, node.typeCondition));
            }
        }
    };
}
function VariablesAreInputTypesRule(context) {
    return {
        VariableDefinition (node) {
            const type = typeFromAST(context.getSchema(), node.type);
            if (type && !isInputType(type)) {
                const variableName = node.variable.name.value;
                const typeName = print(node.type);
                context.reportError(new GraphQLError(`Variable "$${variableName}" cannot be non-input type "${typeName}".`, node.type));
            }
        }
    };
}
function ScalarLeafsRule(context) {
    return {
        Field (node) {
            const type = context.getType();
            const selectionSet = node.selectionSet;
            if (type) {
                if (isLeafType(getNamedType(type))) {
                    if (selectionSet) {
                        const fieldName = node.name.value;
                        const typeStr = inspect(type);
                        context.reportError(new GraphQLError(`Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`, selectionSet));
                    }
                } else if (!selectionSet) {
                    const fieldName1 = node.name.value;
                    const typeStr1 = inspect(type);
                    context.reportError(new GraphQLError(`Field "${fieldName1}" of type "${typeStr1}" must have a selection of subfields. Did you mean "${fieldName1} { ... }"?`, node));
                }
            }
        }
    };
}
function FieldsOnCorrectTypeRule(context) {
    return {
        Field (node) {
            const type = context.getParentType();
            if (type) {
                const fieldDef = context.getFieldDef();
                if (!fieldDef) {
                    const schema = context.getSchema();
                    const fieldName = node.name.value;
                    let suggestion = didYouMean('to use an inline fragment on', getSuggestedTypeNames(schema, type, fieldName));
                    if (suggestion === '') {
                        suggestion = didYouMean(getSuggestedFieldNames(type, fieldName));
                    }
                    context.reportError(new GraphQLError(`Cannot query field "${fieldName}" on type "${type.name}".` + suggestion, node));
                }
            }
        }
    };
}
function getSuggestedTypeNames(schema, type, fieldName) {
    if (!isAbstractType(type)) {
        return [];
    }
    const suggestedTypes = new Set();
    const usageCount = Object.create(null);
    for (const possibleType of schema.getPossibleTypes(type)){
        if (!possibleType.getFields()[fieldName]) {
            continue;
        }
        suggestedTypes.add(possibleType);
        usageCount[possibleType.name] = 1;
        for (const possibleInterface of possibleType.getInterfaces()){
            if (!possibleInterface.getFields()[fieldName]) {
                continue;
            }
            suggestedTypes.add(possibleInterface);
            usageCount[possibleInterface.name] = (usageCount[possibleInterface.name] ?? 0) + 1;
        }
    }
    return arrayFrom(suggestedTypes).sort((typeA, typeB)=>{
        const usageCountDiff = usageCount[typeB.name] - usageCount[typeA.name];
        if (usageCountDiff !== 0) {
            return usageCountDiff;
        }
        if (isInterfaceType(typeA) && schema.isSubType(typeA, typeB)) {
            return -1;
        }
        if (isInterfaceType(typeB) && schema.isSubType(typeB, typeA)) {
            return 1;
        }
        return typeA.name.localeCompare(typeB.name);
    }).map((x)=>x.name);
}
function getSuggestedFieldNames(type, fieldName) {
    if (isObjectType(type) || isInterfaceType(type)) {
        const possibleFieldNames = Object.keys(type.getFields());
        return suggestionList(fieldName, possibleFieldNames);
    }
    return [];
}
function UniqueFragmentNamesRule(context) {
    const knownFragmentNames = Object.create(null);
    return {
        OperationDefinition: ()=>false,
        FragmentDefinition (node) {
            const fragmentName = node.name.value;
            if (knownFragmentNames[fragmentName]) {
                context.reportError(new GraphQLError(`There can be only one fragment named "${fragmentName}".`, [
                    knownFragmentNames[fragmentName],
                    node.name
                ]));
            } else {
                knownFragmentNames[fragmentName] = node.name;
            }
            return false;
        }
    };
}
function KnownFragmentNamesRule(context) {
    return {
        FragmentSpread (node) {
            const fragmentName = node.name.value;
            const fragment = context.getFragment(fragmentName);
            if (!fragment) {
                context.reportError(new GraphQLError(`Unknown fragment "${fragmentName}".`, node.name));
            }
        }
    };
}
function NoUnusedFragmentsRule(context) {
    const operationDefs = [];
    const fragmentDefs = [];
    return {
        OperationDefinition (node) {
            operationDefs.push(node);
            return false;
        },
        FragmentDefinition (node) {
            fragmentDefs.push(node);
            return false;
        },
        Document: {
            leave () {
                const fragmentNameUsed = Object.create(null);
                for (const operation of operationDefs){
                    for (const fragment of context.getRecursivelyReferencedFragments(operation)){
                        fragmentNameUsed[fragment.name.value] = true;
                    }
                }
                for (const fragmentDef of fragmentDefs){
                    const fragName = fragmentDef.name.value;
                    if (fragmentNameUsed[fragName] !== true) {
                        context.reportError(new GraphQLError(`Fragment "${fragName}" is never used.`, fragmentDef));
                    }
                }
            }
        }
    };
}
function PossibleFragmentSpreadsRule(context) {
    return {
        InlineFragment (node) {
            const fragType = context.getType();
            const parentType = context.getParentType();
            if (isCompositeType(fragType) && isCompositeType(parentType) && !doTypesOverlap(context.getSchema(), fragType, parentType)) {
                const parentTypeStr = inspect(parentType);
                const fragTypeStr = inspect(fragType);
                context.reportError(new GraphQLError(`Fragment cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`, node));
            }
        },
        FragmentSpread (node) {
            const fragName = node.name.value;
            const fragType = getFragmentType(context, fragName);
            const parentType = context.getParentType();
            if (fragType && parentType && !doTypesOverlap(context.getSchema(), fragType, parentType)) {
                const parentTypeStr = inspect(parentType);
                const fragTypeStr = inspect(fragType);
                context.reportError(new GraphQLError(`Fragment "${fragName}" cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`, node));
            }
        }
    };
}
function getFragmentType(context, name) {
    const frag = context.getFragment(name);
    if (frag) {
        const type = typeFromAST(context.getSchema(), frag.typeCondition);
        if (isCompositeType(type)) {
            return type;
        }
    }
}
function NoFragmentCyclesRule(context) {
    const visitedFrags = Object.create(null);
    const spreadPath = [];
    const spreadPathIndexByName = Object.create(null);
    return {
        OperationDefinition: ()=>false,
        FragmentDefinition (node) {
            detectCycleRecursive(node);
            return false;
        }
    };
    function detectCycleRecursive(fragment) {
        if (visitedFrags[fragment.name.value]) {
            return;
        }
        const fragmentName = fragment.name.value;
        visitedFrags[fragmentName] = true;
        const spreadNodes = context.getFragmentSpreads(fragment.selectionSet);
        if (spreadNodes.length === 0) {
            return;
        }
        spreadPathIndexByName[fragmentName] = spreadPath.length;
        for (const spreadNode of spreadNodes){
            const spreadName = spreadNode.name.value;
            const cycleIndex = spreadPathIndexByName[spreadName];
            spreadPath.push(spreadNode);
            if (cycleIndex === undefined) {
                const spreadFragment = context.getFragment(spreadName);
                if (spreadFragment) {
                    detectCycleRecursive(spreadFragment);
                }
            } else {
                const cyclePath = spreadPath.slice(cycleIndex);
                const viaPath = cyclePath.slice(0, -1).map((s)=>'"' + s.name.value + '"').join(', ');
                context.reportError(new GraphQLError(`Cannot spread fragment "${spreadName}" within itself` + (viaPath !== '' ? ` via ${viaPath}.` : '.'), cyclePath));
            }
            spreadPath.pop();
        }
        spreadPathIndexByName[fragmentName] = undefined;
    }
}
function UniqueVariableNamesRule(context) {
    let knownVariableNames = Object.create(null);
    return {
        OperationDefinition () {
            knownVariableNames = Object.create(null);
        },
        VariableDefinition (node) {
            const variableName = node.variable.name.value;
            if (knownVariableNames[variableName]) {
                context.reportError(new GraphQLError(`There can be only one variable named "$${variableName}".`, [
                    knownVariableNames[variableName],
                    node.variable.name
                ]));
            } else {
                knownVariableNames[variableName] = node.variable.name;
            }
        }
    };
}
function NoUndefinedVariablesRule(context) {
    let variableNameDefined = Object.create(null);
    return {
        OperationDefinition: {
            enter () {
                variableNameDefined = Object.create(null);
            },
            leave (operation) {
                const usages = context.getRecursiveVariableUsages(operation);
                for (const { node  } of usages){
                    const varName = node.name.value;
                    if (variableNameDefined[varName] !== true) {
                        context.reportError(new GraphQLError(operation.name ? `Variable "$${varName}" is not defined by operation "${operation.name.value}".` : `Variable "$${varName}" is not defined.`, [
                            node,
                            operation
                        ]));
                    }
                }
            }
        },
        VariableDefinition (node) {
            variableNameDefined[node.variable.name.value] = true;
        }
    };
}
function NoUnusedVariablesRule(context) {
    let variableDefs = [];
    return {
        OperationDefinition: {
            enter () {
                variableDefs = [];
            },
            leave (operation) {
                const variableNameUsed = Object.create(null);
                const usages = context.getRecursiveVariableUsages(operation);
                for (const { node  } of usages){
                    variableNameUsed[node.name.value] = true;
                }
                for (const variableDef of variableDefs){
                    const variableName = variableDef.variable.name.value;
                    if (variableNameUsed[variableName] !== true) {
                        context.reportError(new GraphQLError(operation.name ? `Variable "$${variableName}" is never used in operation "${operation.name.value}".` : `Variable "$${variableName}" is never used.`, variableDef));
                    }
                }
            }
        },
        VariableDefinition (def) {
            variableDefs.push(def);
        }
    };
}
function KnownDirectivesRule(context) {
    const locationsMap = Object.create(null);
    const schema = context.getSchema();
    const definedDirectives = schema ? schema.getDirectives() : specifiedDirectives;
    for (const directive of definedDirectives){
        locationsMap[directive.name] = directive.locations;
    }
    const astDefinitions = context.getDocument().definitions;
    for (const def of astDefinitions){
        if (def.kind === Kind.DIRECTIVE_DEFINITION) {
            locationsMap[def.name.value] = def.locations.map((name)=>name.value);
        }
    }
    return {
        Directive (node, _key, _parent, _path, ancestors) {
            const name = node.name.value;
            const locations = locationsMap[name];
            if (!locations) {
                context.reportError(new GraphQLError(`Unknown directive "@${name}".`, node));
                return;
            }
            const candidateLocation = getDirectiveLocationForASTPath(ancestors);
            if (candidateLocation && locations.indexOf(candidateLocation) === -1) {
                context.reportError(new GraphQLError(`Directive "@${name}" may not be used on ${candidateLocation}.`, node));
            }
        }
    };
}
function getDirectiveLocationForASTPath(ancestors) {
    const appliedTo = ancestors[ancestors.length - 1];
    invariant(!Array.isArray(appliedTo));
    switch(appliedTo.kind){
        case Kind.OPERATION_DEFINITION:
            return getDirectiveLocationForOperation(appliedTo.operation);
        case Kind.FIELD:
            return DirectiveLocation.FIELD;
        case Kind.FRAGMENT_SPREAD:
            return DirectiveLocation.FRAGMENT_SPREAD;
        case Kind.INLINE_FRAGMENT:
            return DirectiveLocation.INLINE_FRAGMENT;
        case Kind.FRAGMENT_DEFINITION:
            return DirectiveLocation.FRAGMENT_DEFINITION;
        case Kind.VARIABLE_DEFINITION:
            return DirectiveLocation.VARIABLE_DEFINITION;
        case Kind.SCHEMA_DEFINITION:
        case Kind.SCHEMA_EXTENSION:
            return DirectiveLocation.SCHEMA;
        case Kind.SCALAR_TYPE_DEFINITION:
        case Kind.SCALAR_TYPE_EXTENSION:
            return DirectiveLocation.SCALAR;
        case Kind.OBJECT_TYPE_DEFINITION:
        case Kind.OBJECT_TYPE_EXTENSION:
            return DirectiveLocation.OBJECT;
        case Kind.FIELD_DEFINITION:
            return DirectiveLocation.FIELD_DEFINITION;
        case Kind.INTERFACE_TYPE_DEFINITION:
        case Kind.INTERFACE_TYPE_EXTENSION:
            return DirectiveLocation.INTERFACE;
        case Kind.UNION_TYPE_DEFINITION:
        case Kind.UNION_TYPE_EXTENSION:
            return DirectiveLocation.UNION;
        case Kind.ENUM_TYPE_DEFINITION:
        case Kind.ENUM_TYPE_EXTENSION:
            return DirectiveLocation.ENUM;
        case Kind.ENUM_VALUE_DEFINITION:
            return DirectiveLocation.ENUM_VALUE;
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        case Kind.INPUT_OBJECT_TYPE_EXTENSION:
            return DirectiveLocation.INPUT_OBJECT;
        case Kind.INPUT_VALUE_DEFINITION:
            {
                const parentNode = ancestors[ancestors.length - 3];
                return parentNode.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ? DirectiveLocation.INPUT_FIELD_DEFINITION : DirectiveLocation.ARGUMENT_DEFINITION;
            }
    }
}
function getDirectiveLocationForOperation(operation) {
    switch(operation){
        case 'query':
            return DirectiveLocation.QUERY;
        case 'mutation':
            return DirectiveLocation.MUTATION;
        case 'subscription':
            return DirectiveLocation.SUBSCRIPTION;
    }
    invariant(false, 'Unexpected operation: ' + inspect(operation));
}
function UniqueDirectivesPerLocationRule(context) {
    const uniqueDirectiveMap = Object.create(null);
    const schema = context.getSchema();
    const definedDirectives = schema ? schema.getDirectives() : specifiedDirectives;
    for (const directive of definedDirectives){
        uniqueDirectiveMap[directive.name] = !directive.isRepeatable;
    }
    const astDefinitions = context.getDocument().definitions;
    for (const def of astDefinitions){
        if (def.kind === Kind.DIRECTIVE_DEFINITION) {
            uniqueDirectiveMap[def.name.value] = !def.repeatable;
        }
    }
    const schemaDirectives = Object.create(null);
    const typeDirectivesMap = Object.create(null);
    return {
        enter (node) {
            if (node.directives == null) {
                return;
            }
            let seenDirectives;
            if (node.kind === Kind.SCHEMA_DEFINITION || node.kind === Kind.SCHEMA_EXTENSION) {
                seenDirectives = schemaDirectives;
            } else if (isTypeDefinitionNode(node) || isTypeExtensionNode(node)) {
                const typeName = node.name.value;
                seenDirectives = typeDirectivesMap[typeName];
                if (seenDirectives === undefined) {
                    typeDirectivesMap[typeName] = seenDirectives = Object.create(null);
                }
            } else {
                seenDirectives = Object.create(null);
            }
            for (const directive of node.directives){
                const directiveName = directive.name.value;
                if (uniqueDirectiveMap[directiveName]) {
                    if (seenDirectives[directiveName]) {
                        context.reportError(new GraphQLError(`The directive "@${directiveName}" can only be used once at this location.`, [
                            seenDirectives[directiveName],
                            directive
                        ]));
                    } else {
                        seenDirectives[directiveName] = directive;
                    }
                }
            }
        }
    };
}
function KnownArgumentNamesRule(context) {
    return {
        ...KnownArgumentNamesOnDirectivesRule(context),
        Argument (argNode) {
            const argDef = context.getArgument();
            const fieldDef = context.getFieldDef();
            const parentType = context.getParentType();
            if (!argDef && fieldDef && parentType) {
                const argName = argNode.name.value;
                const knownArgsNames = fieldDef.args.map((arg)=>arg.name);
                const suggestions = suggestionList(argName, knownArgsNames);
                context.reportError(new GraphQLError(`Unknown argument "${argName}" on field "${parentType.name}.${fieldDef.name}".` + didYouMean(suggestions), argNode));
            }
        }
    };
}
function KnownArgumentNamesOnDirectivesRule(context) {
    const directiveArgs = Object.create(null);
    const schema = context.getSchema();
    const definedDirectives = schema ? schema.getDirectives() : specifiedDirectives;
    for (const directive of definedDirectives){
        directiveArgs[directive.name] = directive.args.map((arg)=>arg.name);
    }
    const astDefinitions = context.getDocument().definitions;
    for (const def of astDefinitions){
        if (def.kind === Kind.DIRECTIVE_DEFINITION) {
            const argsNodes = def.arguments ?? [];
            directiveArgs[def.name.value] = argsNodes.map((arg)=>arg.name.value);
        }
    }
    return {
        Directive (directiveNode) {
            const directiveName = directiveNode.name.value;
            const knownArgs = directiveArgs[directiveName];
            if (directiveNode.arguments && knownArgs) {
                for (const argNode of directiveNode.arguments){
                    const argName = argNode.name.value;
                    if (knownArgs.indexOf(argName) === -1) {
                        const suggestions = suggestionList(argName, knownArgs);
                        context.reportError(new GraphQLError(`Unknown argument "${argName}" on directive "@${directiveName}".` + didYouMean(suggestions), argNode));
                    }
                }
            }
            return false;
        }
    };
}
function UniqueArgumentNamesRule(context) {
    let knownArgNames = Object.create(null);
    return {
        Field () {
            knownArgNames = Object.create(null);
        },
        Directive () {
            knownArgNames = Object.create(null);
        },
        Argument (node) {
            const argName = node.name.value;
            if (knownArgNames[argName]) {
                context.reportError(new GraphQLError(`There can be only one argument named "${argName}".`, [
                    knownArgNames[argName],
                    node.name
                ]));
            } else {
                knownArgNames[argName] = node.name;
            }
            return false;
        }
    };
}
function ValuesOfCorrectTypeRule(context) {
    return {
        ListValue (node) {
            const type = getNullableType(context.getParentInputType());
            if (!isListType(type)) {
                isValidValueNode(context, node);
                return false;
            }
        },
        ObjectValue (node) {
            const type = getNamedType(context.getInputType());
            if (!isInputObjectType(type)) {
                isValidValueNode(context, node);
                return false;
            }
            const fieldNodeMap = keyMap(node.fields, (field)=>field.name.value);
            for (const fieldDef of objectValues(type.getFields())){
                const fieldNode = fieldNodeMap[fieldDef.name];
                if (!fieldNode && isRequiredInputField(fieldDef)) {
                    const typeStr = inspect(fieldDef.type);
                    context.reportError(new GraphQLError(`Field "${type.name}.${fieldDef.name}" of required type "${typeStr}" was not provided.`, node));
                }
            }
        },
        ObjectField (node) {
            const parentType = getNamedType(context.getParentInputType());
            const fieldType = context.getInputType();
            if (!fieldType && isInputObjectType(parentType)) {
                const suggestions = suggestionList(node.name.value, Object.keys(parentType.getFields()));
                context.reportError(new GraphQLError(`Field "${node.name.value}" is not defined by type "${parentType.name}".` + didYouMean(suggestions), node));
            }
        },
        NullValue (node) {
            const type = context.getInputType();
            if (isNonNullType(type)) {
                context.reportError(new GraphQLError(`Expected value of type "${inspect(type)}", found ${print(node)}.`, node));
            }
        },
        EnumValue: (node)=>isValidValueNode(context, node),
        IntValue: (node)=>isValidValueNode(context, node),
        FloatValue: (node)=>isValidValueNode(context, node),
        StringValue: (node)=>isValidValueNode(context, node),
        BooleanValue: (node)=>isValidValueNode(context, node)
    };
}
function isValidValueNode(context, node) {
    const locationType = context.getInputType();
    if (!locationType) {
        return;
    }
    const type = getNamedType(locationType);
    if (!isLeafType(type)) {
        const typeStr = inspect(locationType);
        context.reportError(new GraphQLError(`Expected value of type "${typeStr}", found ${print(node)}.`, node));
        return;
    }
    try {
        const parseResult = type.parseLiteral(node, undefined);
        if (parseResult === undefined) {
            const typeStr1 = inspect(locationType);
            context.reportError(new GraphQLError(`Expected value of type "${typeStr1}", found ${print(node)}.`, node));
        }
    } catch (error) {
        const typeStr2 = inspect(locationType);
        if (error instanceof GraphQLError) {
            context.reportError(error);
        } else {
            context.reportError(new GraphQLError(`Expected value of type "${typeStr2}", found ${print(node)}; ` + error.message, node, undefined, undefined, undefined, error));
        }
    }
}
function ProvidedRequiredArgumentsRule(context) {
    return {
        ...ProvidedRequiredArgumentsOnDirectivesRule(context),
        Field: {
            leave (fieldNode) {
                const fieldDef = context.getFieldDef();
                if (!fieldDef) {
                    return false;
                }
                const argNodes = fieldNode.arguments ?? [];
                const argNodeMap = keyMap(argNodes, (arg)=>arg.name.value);
                for (const argDef of fieldDef.args){
                    const argNode = argNodeMap[argDef.name];
                    if (!argNode && isRequiredArgument(argDef)) {
                        const argTypeStr = inspect(argDef.type);
                        context.reportError(new GraphQLError(`Field "${fieldDef.name}" argument "${argDef.name}" of type "${argTypeStr}" is required, but it was not provided.`, fieldNode));
                    }
                }
            }
        }
    };
}
function ProvidedRequiredArgumentsOnDirectivesRule(context) {
    const requiredArgsMap = Object.create(null);
    const schema = context.getSchema();
    const definedDirectives = schema ? schema.getDirectives() : specifiedDirectives;
    for (const directive of definedDirectives){
        requiredArgsMap[directive.name] = keyMap(directive.args.filter(isRequiredArgument), (arg)=>arg.name);
    }
    const astDefinitions = context.getDocument().definitions;
    for (const def of astDefinitions){
        if (def.kind === Kind.DIRECTIVE_DEFINITION) {
            const argNodes = def.arguments ?? [];
            requiredArgsMap[def.name.value] = keyMap(argNodes.filter(isRequiredArgumentNode), (arg)=>arg.name.value);
        }
    }
    return {
        Directive: {
            leave (directiveNode) {
                const directiveName = directiveNode.name.value;
                const requiredArgs = requiredArgsMap[directiveName];
                if (requiredArgs) {
                    const argNodes = directiveNode.arguments ?? [];
                    const argNodeMap = keyMap(argNodes, (arg)=>arg.name.value);
                    for (const argName of Object.keys(requiredArgs)){
                        if (!argNodeMap[argName]) {
                            const argType = requiredArgs[argName].type;
                            const argTypeStr = isType(argType) ? inspect(argType) : print(argType);
                            context.reportError(new GraphQLError(`Directive "@${directiveName}" argument "${argName}" of type "${argTypeStr}" is required, but it was not provided.`, directiveNode));
                        }
                    }
                }
            }
        }
    };
}
function isRequiredArgumentNode(arg) {
    return arg.type.kind === Kind.NON_NULL_TYPE && arg.defaultValue == null;
}
function VariablesInAllowedPositionRule(context) {
    let varDefMap = Object.create(null);
    return {
        OperationDefinition: {
            enter () {
                varDefMap = Object.create(null);
            },
            leave (operation) {
                const usages = context.getRecursiveVariableUsages(operation);
                for (const { node , type , defaultValue  } of usages){
                    const varName = node.name.value;
                    const varDef = varDefMap[varName];
                    if (varDef && type) {
                        const schema = context.getSchema();
                        const varType = typeFromAST(schema, varDef.type);
                        if (varType && !allowedVariableUsage(schema, varType, varDef.defaultValue, type, defaultValue)) {
                            const varTypeStr = inspect(varType);
                            const typeStr = inspect(type);
                            context.reportError(new GraphQLError(`Variable "$${varName}" of type "${varTypeStr}" used in position expecting type "${typeStr}".`, [
                                varDef,
                                node
                            ]));
                        }
                    }
                }
            }
        },
        VariableDefinition (node) {
            varDefMap[node.variable.name.value] = node;
        }
    };
}
function allowedVariableUsage(schema, varType, varDefaultValue, locationType, locationDefaultValue) {
    if (isNonNullType(locationType) && !isNonNullType(varType)) {
        const hasNonNullVariableDefaultValue = varDefaultValue != null && varDefaultValue.kind !== Kind.NULL;
        const hasLocationDefaultValue = locationDefaultValue !== undefined;
        if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
            return false;
        }
        const nullableLocationType = locationType.ofType;
        return isTypeSubTypeOf(schema, varType, nullableLocationType);
    }
    return isTypeSubTypeOf(schema, varType, locationType);
}
function reasonMessage(reason) {
    if (Array.isArray(reason)) {
        return reason.map(([responseName, subReason])=>`subfields "${responseName}" conflict because ` + reasonMessage(subReason)).join(' and ');
    }
    return reason;
}
function OverlappingFieldsCanBeMergedRule(context) {
    const comparedFragmentPairs = new PairSet();
    const cachedFieldsAndFragmentNames = new Map();
    return {
        SelectionSet (selectionSet) {
            const conflicts = findConflictsWithinSelectionSet(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, context.getParentType(), selectionSet);
            for (const [[responseName, reason], fields1, fields2] of conflicts){
                const reasonMsg = reasonMessage(reason);
                context.reportError(new GraphQLError(`Fields "${responseName}" conflict because ${reasonMsg}. Use different aliases on the fields to fetch both if this was intentional.`, fields1.concat(fields2)));
            }
        }
    };
}
function findConflictsWithinSelectionSet(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentType, selectionSet) {
    const conflicts = [];
    const [fieldMap, fragmentNames] = getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType, selectionSet);
    collectConflictsWithin(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, fieldMap);
    if (fragmentNames.length !== 0) {
        for(let i = 0; i < fragmentNames.length; i++){
            collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, false, fieldMap, fragmentNames[i]);
            for(let j = i + 1; j < fragmentNames.length; j++){
                collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, false, fragmentNames[i], fragmentNames[j]);
            }
        }
    }
    return conflicts;
}
function collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap, fragmentName) {
    const fragment = context.getFragment(fragmentName);
    if (!fragment) {
        return;
    }
    const [fieldMap2, fragmentNames2] = getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment);
    if (fieldMap === fieldMap2) {
        return;
    }
    collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap, fieldMap2);
    for(let i = 0; i < fragmentNames2.length; i++){
        collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap, fragmentNames2[i]);
    }
}
function collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentName1, fragmentName2) {
    if (fragmentName1 === fragmentName2) {
        return;
    }
    if (comparedFragmentPairs.has(fragmentName1, fragmentName2, areMutuallyExclusive)) {
        return;
    }
    comparedFragmentPairs.add(fragmentName1, fragmentName2, areMutuallyExclusive);
    const fragment1 = context.getFragment(fragmentName1);
    const fragment2 = context.getFragment(fragmentName2);
    if (!fragment1 || !fragment2) {
        return;
    }
    const [fieldMap1, fragmentNames1] = getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment1);
    const [fieldMap2, fragmentNames2] = getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment2);
    collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, fieldMap2);
    for(let j = 0; j < fragmentNames2.length; j++){
        collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentName1, fragmentNames2[j]);
    }
    for(let i = 0; i < fragmentNames1.length; i++){
        collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentNames1[i], fragmentName2);
    }
}
function findConflictsBetweenSubSelectionSets(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, parentType1, selectionSet1, parentType2, selectionSet2) {
    const conflicts = [];
    const [fieldMap1, fragmentNames1] = getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType1, selectionSet1);
    const [fieldMap2, fragmentNames2] = getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType2, selectionSet2);
    collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, fieldMap2);
    if (fragmentNames2.length !== 0) {
        for(let j = 0; j < fragmentNames2.length; j++){
            collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, fragmentNames2[j]);
        }
    }
    if (fragmentNames1.length !== 0) {
        for(let i = 0; i < fragmentNames1.length; i++){
            collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap2, fragmentNames1[i]);
        }
    }
    for(let i1 = 0; i1 < fragmentNames1.length; i1++){
        for(let j1 = 0; j1 < fragmentNames2.length; j1++){
            collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentNames1[i1], fragmentNames2[j1]);
        }
    }
    return conflicts;
}
function collectConflictsWithin(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, fieldMap) {
    for (const [responseName, fields] of objectEntries(fieldMap)){
        if (fields.length > 1) {
            for(let i = 0; i < fields.length; i++){
                for(let j = i + 1; j < fields.length; j++){
                    const conflict = findConflict(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, false, responseName, fields[i], fields[j]);
                    if (conflict) {
                        conflicts.push(conflict);
                    }
                }
            }
        }
    }
}
function collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, fieldMap1, fieldMap2) {
    for (const responseName of Object.keys(fieldMap1)){
        const fields2 = fieldMap2[responseName];
        if (fields2) {
            const fields1 = fieldMap1[responseName];
            for(let i = 0; i < fields1.length; i++){
                for(let j = 0; j < fields2.length; j++){
                    const conflict = findConflict(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, responseName, fields1[i], fields2[j]);
                    if (conflict) {
                        conflicts.push(conflict);
                    }
                }
            }
        }
    }
}
function findConflict(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, responseName, field1, field2) {
    const [parentType1, node1, def1] = field1;
    const [parentType2, node2, def2] = field2;
    const areMutuallyExclusive = parentFieldsAreMutuallyExclusive || parentType1 !== parentType2 && isObjectType(parentType1) && isObjectType(parentType2);
    if (!areMutuallyExclusive) {
        const name1 = node1.name.value;
        const name2 = node2.name.value;
        if (name1 !== name2) {
            return [
                [
                    responseName,
                    `"${name1}" and "${name2}" are different fields`
                ],
                [
                    node1
                ],
                [
                    node2
                ]
            ];
        }
        const args1 = node1.arguments ?? [];
        const args2 = node2.arguments ?? [];
        if (!sameArguments(args1, args2)) {
            return [
                [
                    responseName,
                    'they have differing arguments'
                ],
                [
                    node1
                ],
                [
                    node2
                ]
            ];
        }
    }
    const type1 = def1?.type;
    const type2 = def2?.type;
    if (type1 && type2 && doTypesConflict(type1, type2)) {
        return [
            [
                responseName,
                `they return conflicting types "${inspect(type1)}" and "${inspect(type2)}"`
            ],
            [
                node1
            ],
            [
                node2
            ]
        ];
    }
    const selectionSet1 = node1.selectionSet;
    const selectionSet2 = node2.selectionSet;
    if (selectionSet1 && selectionSet2) {
        const conflicts = findConflictsBetweenSubSelectionSets(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, getNamedType(type1), selectionSet1, getNamedType(type2), selectionSet2);
        return subfieldConflicts(conflicts, responseName, node1, node2);
    }
}
function sameArguments(arguments1, arguments2) {
    if (arguments1.length !== arguments2.length) {
        return false;
    }
    return arguments1.every((argument1)=>{
        const argument2 = find(arguments2, (argument)=>argument.name.value === argument1.name.value);
        if (!argument2) {
            return false;
        }
        return sameValue(argument1.value, argument2.value);
    });
}
function sameValue(value1, value2) {
    return print(value1) === print(value2);
}
function doTypesConflict(type1, type2) {
    if (isListType(type1)) {
        return isListType(type2) ? doTypesConflict(type1.ofType, type2.ofType) : true;
    }
    if (isListType(type2)) {
        return true;
    }
    if (isNonNullType(type1)) {
        return isNonNullType(type2) ? doTypesConflict(type1.ofType, type2.ofType) : true;
    }
    if (isNonNullType(type2)) {
        return true;
    }
    if (isLeafType(type1) || isLeafType(type2)) {
        return type1 !== type2;
    }
    return false;
}
function getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType, selectionSet) {
    let cached = cachedFieldsAndFragmentNames.get(selectionSet);
    if (!cached) {
        const nodeAndDefs = Object.create(null);
        const fragmentNames = Object.create(null);
        _collectFieldsAndFragmentNames(context, parentType, selectionSet, nodeAndDefs, fragmentNames);
        cached = [
            nodeAndDefs,
            Object.keys(fragmentNames)
        ];
        cachedFieldsAndFragmentNames.set(selectionSet, cached);
    }
    return cached;
}
function getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment) {
    const cached = cachedFieldsAndFragmentNames.get(fragment.selectionSet);
    if (cached) {
        return cached;
    }
    const fragmentType = typeFromAST(context.getSchema(), fragment.typeCondition);
    return getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragmentType, fragment.selectionSet);
}
function _collectFieldsAndFragmentNames(context, parentType, selectionSet, nodeAndDefs, fragmentNames) {
    for (const selection of selectionSet.selections){
        switch(selection.kind){
            case Kind.FIELD:
                {
                    const fieldName = selection.name.value;
                    let fieldDef;
                    if (isObjectType(parentType) || isInterfaceType(parentType)) {
                        fieldDef = parentType.getFields()[fieldName];
                    }
                    const responseName = selection.alias ? selection.alias.value : fieldName;
                    if (!nodeAndDefs[responseName]) {
                        nodeAndDefs[responseName] = [];
                    }
                    nodeAndDefs[responseName].push([
                        parentType,
                        selection,
                        fieldDef
                    ]);
                    break;
                }
            case Kind.FRAGMENT_SPREAD:
                fragmentNames[selection.name.value] = true;
                break;
            case Kind.INLINE_FRAGMENT:
                {
                    const typeCondition = selection.typeCondition;
                    const inlineFragmentType = typeCondition ? typeFromAST(context.getSchema(), typeCondition) : parentType;
                    _collectFieldsAndFragmentNames(context, inlineFragmentType, selection.selectionSet, nodeAndDefs, fragmentNames);
                    break;
                }
        }
    }
}
function subfieldConflicts(conflicts, responseName, node1, node2) {
    if (conflicts.length > 0) {
        return [
            [
                responseName,
                conflicts.map(([reason])=>reason)
            ],
            conflicts.reduce((allFields, [, fields1])=>allFields.concat(fields1), [
                node1
            ]),
            conflicts.reduce((allFields, [, , fields2])=>allFields.concat(fields2), [
                node2
            ])
        ];
    }
}
class PairSet {
    constructor(){
        this._data = Object.create(null);
    }
    has(a, b, areMutuallyExclusive) {
        const first = this._data[a];
        const result = first && first[b];
        if (result === undefined) {
            return false;
        }
        if (areMutuallyExclusive === false) {
            return result === false;
        }
        return true;
    }
    add(a, b, areMutuallyExclusive) {
        _pairSetAdd(this._data, a, b, areMutuallyExclusive);
        _pairSetAdd(this._data, b, a, areMutuallyExclusive);
    }
}
function _pairSetAdd(data, a, b, areMutuallyExclusive) {
    let map = data[a];
    if (!map) {
        map = Object.create(null);
        data[a] = map;
    }
    map[b] = areMutuallyExclusive;
}
function UniqueInputFieldNamesRule(context) {
    const knownNameStack = [];
    let knownNames = Object.create(null);
    return {
        ObjectValue: {
            enter () {
                knownNameStack.push(knownNames);
                knownNames = Object.create(null);
            },
            leave () {
                knownNames = knownNameStack.pop();
            }
        },
        ObjectField (node) {
            const fieldName = node.name.value;
            if (knownNames[fieldName]) {
                context.reportError(new GraphQLError(`There can be only one input field named "${fieldName}".`, [
                    knownNames[fieldName],
                    node.name
                ]));
            } else {
                knownNames[fieldName] = node.name;
            }
        }
    };
}
function LoneSchemaDefinitionRule(context) {
    const oldSchema = context.getSchema();
    const alreadyDefined = ((oldSchema?.astNode ?? oldSchema?.getQueryType()) ?? oldSchema?.getMutationType()) ?? oldSchema?.getSubscriptionType();
    let schemaDefinitionsCount = 0;
    return {
        SchemaDefinition (node) {
            if (alreadyDefined) {
                context.reportError(new GraphQLError('Cannot define a new schema within a schema extension.', node));
                return;
            }
            if (schemaDefinitionsCount > 0) {
                context.reportError(new GraphQLError('Must provide only one schema definition.', node));
            }
            ++schemaDefinitionsCount;
        }
    };
}
function UniqueOperationTypesRule(context) {
    const schema = context.getSchema();
    const definedOperationTypes = Object.create(null);
    const existingOperationTypes = schema ? {
        query: schema.getQueryType(),
        mutation: schema.getMutationType(),
        subscription: schema.getSubscriptionType()
    } : {};
    return {
        SchemaDefinition: checkOperationTypes,
        SchemaExtension: checkOperationTypes
    };
    function checkOperationTypes(node) {
        const operationTypesNodes = node.operationTypes ?? [];
        for (const operationType of operationTypesNodes){
            const operation = operationType.operation;
            const alreadyDefinedOperationType = definedOperationTypes[operation];
            if (existingOperationTypes[operation]) {
                context.reportError(new GraphQLError(`Type for ${operation} already defined in the schema. It cannot be redefined.`, operationType));
            } else if (alreadyDefinedOperationType) {
                context.reportError(new GraphQLError(`There can be only one ${operation} type in schema.`, [
                    alreadyDefinedOperationType,
                    operationType
                ]));
            } else {
                definedOperationTypes[operation] = operationType;
            }
        }
        return false;
    }
}
function UniqueTypeNamesRule(context) {
    const knownTypeNames = Object.create(null);
    const schema = context.getSchema();
    return {
        ScalarTypeDefinition: checkTypeName,
        ObjectTypeDefinition: checkTypeName,
        InterfaceTypeDefinition: checkTypeName,
        UnionTypeDefinition: checkTypeName,
        EnumTypeDefinition: checkTypeName,
        InputObjectTypeDefinition: checkTypeName
    };
    function checkTypeName(node) {
        const typeName = node.name.value;
        if (schema?.getType(typeName)) {
            context.reportError(new GraphQLError(`Type "${typeName}" already exists in the schema. It cannot also be defined in this type definition.`, node.name));
            return;
        }
        if (knownTypeNames[typeName]) {
            context.reportError(new GraphQLError(`There can be only one type named "${typeName}".`, [
                knownTypeNames[typeName],
                node.name
            ]));
        } else {
            knownTypeNames[typeName] = node.name;
        }
        return false;
    }
}
function UniqueEnumValueNamesRule(context) {
    const schema = context.getSchema();
    const existingTypeMap = schema ? schema.getTypeMap() : Object.create(null);
    const knownValueNames = Object.create(null);
    return {
        EnumTypeDefinition: checkValueUniqueness,
        EnumTypeExtension: checkValueUniqueness
    };
    function checkValueUniqueness(node) {
        const typeName = node.name.value;
        if (!knownValueNames[typeName]) {
            knownValueNames[typeName] = Object.create(null);
        }
        const valueNodes = node.values ?? [];
        const valueNames = knownValueNames[typeName];
        for (const valueDef of valueNodes){
            const valueName = valueDef.name.value;
            const existingType = existingTypeMap[typeName];
            if (isEnumType(existingType) && existingType.getValue(valueName)) {
                context.reportError(new GraphQLError(`Enum value "${typeName}.${valueName}" already exists in the schema. It cannot also be defined in this type extension.`, valueDef.name));
            } else if (valueNames[valueName]) {
                context.reportError(new GraphQLError(`Enum value "${typeName}.${valueName}" can only be defined once.`, [
                    valueNames[valueName],
                    valueDef.name
                ]));
            } else {
                valueNames[valueName] = valueDef.name;
            }
        }
        return false;
    }
}
function UniqueFieldDefinitionNamesRule(context) {
    const schema = context.getSchema();
    const existingTypeMap = schema ? schema.getTypeMap() : Object.create(null);
    const knownFieldNames = Object.create(null);
    return {
        InputObjectTypeDefinition: checkFieldUniqueness,
        InputObjectTypeExtension: checkFieldUniqueness,
        InterfaceTypeDefinition: checkFieldUniqueness,
        InterfaceTypeExtension: checkFieldUniqueness,
        ObjectTypeDefinition: checkFieldUniqueness,
        ObjectTypeExtension: checkFieldUniqueness
    };
    function checkFieldUniqueness(node) {
        const typeName = node.name.value;
        if (!knownFieldNames[typeName]) {
            knownFieldNames[typeName] = Object.create(null);
        }
        const fieldNodes = node.fields ?? [];
        const fieldNames = knownFieldNames[typeName];
        for (const fieldDef of fieldNodes){
            const fieldName = fieldDef.name.value;
            if (hasField(existingTypeMap[typeName], fieldName)) {
                context.reportError(new GraphQLError(`Field "${typeName}.${fieldName}" already exists in the schema. It cannot also be defined in this type extension.`, fieldDef.name));
            } else if (fieldNames[fieldName]) {
                context.reportError(new GraphQLError(`Field "${typeName}.${fieldName}" can only be defined once.`, [
                    fieldNames[fieldName],
                    fieldDef.name
                ]));
            } else {
                fieldNames[fieldName] = fieldDef.name;
            }
        }
        return false;
    }
}
function hasField(type, fieldName) {
    if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
        return type.getFields()[fieldName];
    }
    return false;
}
function UniqueDirectiveNamesRule(context) {
    const knownDirectiveNames = Object.create(null);
    const schema = context.getSchema();
    return {
        DirectiveDefinition (node) {
            const directiveName = node.name.value;
            if (schema?.getDirective(directiveName)) {
                context.reportError(new GraphQLError(`Directive "@${directiveName}" already exists in the schema. It cannot be redefined.`, node.name));
                return;
            }
            if (knownDirectiveNames[directiveName]) {
                context.reportError(new GraphQLError(`There can be only one directive named "@${directiveName}".`, [
                    knownDirectiveNames[directiveName],
                    node.name
                ]));
            } else {
                knownDirectiveNames[directiveName] = node.name;
            }
            return false;
        }
    };
}
function PossibleTypeExtensionsRule(context) {
    const schema = context.getSchema();
    const definedTypes = Object.create(null);
    for (const def of context.getDocument().definitions){
        if (isTypeDefinitionNode(def)) {
            definedTypes[def.name.value] = def;
        }
    }
    return {
        ScalarTypeExtension: checkExtension,
        ObjectTypeExtension: checkExtension,
        InterfaceTypeExtension: checkExtension,
        UnionTypeExtension: checkExtension,
        EnumTypeExtension: checkExtension,
        InputObjectTypeExtension: checkExtension
    };
    function checkExtension(node) {
        const typeName = node.name.value;
        const defNode = definedTypes[typeName];
        const existingType = schema?.getType(typeName);
        let expectedKind;
        if (defNode) {
            expectedKind = defKindToExtKind[defNode.kind];
        } else if (existingType) {
            expectedKind = typeToExtKind(existingType);
        }
        if (expectedKind) {
            if (expectedKind !== node.kind) {
                const kindStr = extensionKindToTypeName(node.kind);
                context.reportError(new GraphQLError(`Cannot extend non-${kindStr} type "${typeName}".`, defNode ? [
                    defNode,
                    node
                ] : node));
            }
        } else {
            let allTypeNames = Object.keys(definedTypes);
            if (schema) {
                allTypeNames = allTypeNames.concat(Object.keys(schema.getTypeMap()));
            }
            const suggestedTypes = suggestionList(typeName, allTypeNames);
            context.reportError(new GraphQLError(`Cannot extend type "${typeName}" because it is not defined.` + didYouMean(suggestedTypes), node.name));
        }
    }
}
const defKindToExtKind = {
    [Kind.SCALAR_TYPE_DEFINITION]: Kind.SCALAR_TYPE_EXTENSION,
    [Kind.OBJECT_TYPE_DEFINITION]: Kind.OBJECT_TYPE_EXTENSION,
    [Kind.INTERFACE_TYPE_DEFINITION]: Kind.INTERFACE_TYPE_EXTENSION,
    [Kind.UNION_TYPE_DEFINITION]: Kind.UNION_TYPE_EXTENSION,
    [Kind.ENUM_TYPE_DEFINITION]: Kind.ENUM_TYPE_EXTENSION,
    [Kind.INPUT_OBJECT_TYPE_DEFINITION]: Kind.INPUT_OBJECT_TYPE_EXTENSION
};
function typeToExtKind(type) {
    if (isScalarType(type)) {
        return Kind.SCALAR_TYPE_EXTENSION;
    }
    if (isObjectType(type)) {
        return Kind.OBJECT_TYPE_EXTENSION;
    }
    if (isInterfaceType(type)) {
        return Kind.INTERFACE_TYPE_EXTENSION;
    }
    if (isUnionType(type)) {
        return Kind.UNION_TYPE_EXTENSION;
    }
    if (isEnumType(type)) {
        return Kind.ENUM_TYPE_EXTENSION;
    }
    if (isInputObjectType(type)) {
        return Kind.INPUT_OBJECT_TYPE_EXTENSION;
    }
    invariant(false, 'Unexpected type: ' + inspect(type));
}
function extensionKindToTypeName(kind) {
    switch(kind){
        case Kind.SCALAR_TYPE_EXTENSION:
            return 'scalar';
        case Kind.OBJECT_TYPE_EXTENSION:
            return 'object';
        case Kind.INTERFACE_TYPE_EXTENSION:
            return 'interface';
        case Kind.UNION_TYPE_EXTENSION:
            return 'union';
        case Kind.ENUM_TYPE_EXTENSION:
            return 'enum';
        case Kind.INPUT_OBJECT_TYPE_EXTENSION:
            return 'input object';
    }
    invariant(false, 'Unexpected kind: ' + inspect(kind));
}
const specifiedRules = Object.freeze([
    ExecutableDefinitionsRule,
    UniqueOperationNamesRule,
    LoneAnonymousOperationRule,
    SingleFieldSubscriptionsRule,
    KnownTypeNamesRule,
    FragmentsOnCompositeTypesRule,
    VariablesAreInputTypesRule,
    ScalarLeafsRule,
    FieldsOnCorrectTypeRule,
    UniqueFragmentNamesRule,
    KnownFragmentNamesRule,
    NoUnusedFragmentsRule,
    PossibleFragmentSpreadsRule,
    NoFragmentCyclesRule,
    UniqueVariableNamesRule,
    NoUndefinedVariablesRule,
    NoUnusedVariablesRule,
    KnownDirectivesRule,
    UniqueDirectivesPerLocationRule,
    KnownArgumentNamesRule,
    UniqueArgumentNamesRule,
    ValuesOfCorrectTypeRule,
    ProvidedRequiredArgumentsRule,
    VariablesInAllowedPositionRule,
    OverlappingFieldsCanBeMergedRule,
    UniqueInputFieldNamesRule
]);
const specifiedSDLRules = Object.freeze([
    LoneSchemaDefinitionRule,
    UniqueOperationTypesRule,
    UniqueTypeNamesRule,
    UniqueEnumValueNamesRule,
    UniqueFieldDefinitionNamesRule,
    UniqueDirectiveNamesRule,
    KnownTypeNamesRule,
    KnownDirectivesRule,
    UniqueDirectivesPerLocationRule,
    PossibleTypeExtensionsRule,
    KnownArgumentNamesOnDirectivesRule,
    UniqueArgumentNamesRule,
    UniqueInputFieldNamesRule,
    ProvidedRequiredArgumentsOnDirectivesRule
]);
class ASTValidationContext {
    constructor(ast, onError){
        this._ast = ast;
        this._fragments = undefined;
        this._fragmentSpreads = new Map();
        this._recursivelyReferencedFragments = new Map();
        this._onError = onError;
    }
    reportError(error) {
        this._onError(error);
    }
    getDocument() {
        return this._ast;
    }
    getFragment(name) {
        let fragments = this._fragments;
        if (!fragments) {
            this._fragments = fragments = this.getDocument().definitions.reduce((frags, statement)=>{
                if (statement.kind === Kind.FRAGMENT_DEFINITION) {
                    frags[statement.name.value] = statement;
                }
                return frags;
            }, Object.create(null));
        }
        return fragments[name];
    }
    getFragmentSpreads(node) {
        let spreads = this._fragmentSpreads.get(node);
        if (!spreads) {
            spreads = [];
            const setsToVisit = [
                node
            ];
            while(setsToVisit.length !== 0){
                const set = setsToVisit.pop();
                for (const selection of set.selections){
                    if (selection.kind === Kind.FRAGMENT_SPREAD) {
                        spreads.push(selection);
                    } else if (selection.selectionSet) {
                        setsToVisit.push(selection.selectionSet);
                    }
                }
            }
            this._fragmentSpreads.set(node, spreads);
        }
        return spreads;
    }
    getRecursivelyReferencedFragments(operation) {
        let fragments = this._recursivelyReferencedFragments.get(operation);
        if (!fragments) {
            fragments = [];
            const collectedNames = Object.create(null);
            const nodesToVisit = [
                operation.selectionSet
            ];
            while(nodesToVisit.length !== 0){
                const node = nodesToVisit.pop();
                for (const spread of this.getFragmentSpreads(node)){
                    const fragName = spread.name.value;
                    if (collectedNames[fragName] !== true) {
                        collectedNames[fragName] = true;
                        const fragment = this.getFragment(fragName);
                        if (fragment) {
                            fragments.push(fragment);
                            nodesToVisit.push(fragment.selectionSet);
                        }
                    }
                }
            }
            this._recursivelyReferencedFragments.set(operation, fragments);
        }
        return fragments;
    }
}
class SDLValidationContext extends ASTValidationContext {
    constructor(ast, schema, onError){
        super(ast, onError);
        this._schema = schema;
    }
    getSchema() {
        return this._schema;
    }
}
class ValidationContext extends ASTValidationContext {
    constructor(schema, ast, typeInfo, onError){
        super(ast, onError);
        this._schema = schema;
        this._typeInfo = typeInfo;
        this._variableUsages = new Map();
        this._recursiveVariableUsages = new Map();
    }
    getSchema() {
        return this._schema;
    }
    getVariableUsages(node) {
        let usages = this._variableUsages.get(node);
        if (!usages) {
            const newUsages = [];
            const typeInfo = new TypeInfo(this._schema);
            visit(node, visitWithTypeInfo(typeInfo, {
                VariableDefinition: ()=>false,
                Variable (variable) {
                    newUsages.push({
                        node: variable,
                        type: typeInfo.getInputType(),
                        defaultValue: typeInfo.getDefaultValue()
                    });
                }
            }));
            usages = newUsages;
            this._variableUsages.set(node, usages);
        }
        return usages;
    }
    getRecursiveVariableUsages(operation) {
        let usages = this._recursiveVariableUsages.get(operation);
        if (!usages) {
            usages = this.getVariableUsages(operation);
            for (const frag of this.getRecursivelyReferencedFragments(operation)){
                usages = usages.concat(this.getVariableUsages(frag));
            }
            this._recursiveVariableUsages.set(operation, usages);
        }
        return usages;
    }
    getType() {
        return this._typeInfo.getType();
    }
    getParentType() {
        return this._typeInfo.getParentType();
    }
    getInputType() {
        return this._typeInfo.getInputType();
    }
    getParentInputType() {
        return this._typeInfo.getParentInputType();
    }
    getFieldDef() {
        return this._typeInfo.getFieldDef();
    }
    getDirective() {
        return this._typeInfo.getDirective();
    }
    getArgument() {
        return this._typeInfo.getArgument();
    }
}
function validate(schema, documentAST, rules = specifiedRules, typeInfo = new TypeInfo(schema), options = {
    maxErrors: undefined
}) {
    devAssert(documentAST, 'Must provide document.');
    assertValidSchema(schema);
    const abortObj = Object.freeze({});
    const errors = [];
    const context = new ValidationContext(schema, documentAST, typeInfo, (error)=>{
        if (options.maxErrors != null && errors.length >= options.maxErrors) {
            errors.push(new GraphQLError('Too many validation errors, error limit reached. Validation aborted.'));
            throw abortObj;
        }
        errors.push(error);
    });
    const visitor = visitInParallel(rules.map((rule)=>rule(context)));
    try {
        visit(documentAST, visitWithTypeInfo(typeInfo, visitor));
    } catch (e) {
        if (e !== abortObj) {
            throw e;
        }
    }
    return errors;
}
function validateSDL(documentAST, schemaToExtend, rules = specifiedSDLRules) {
    const errors = [];
    const context = new SDLValidationContext(documentAST, schemaToExtend, (error)=>{
        errors.push(error);
    });
    const visitors = rules.map((rule)=>rule(context));
    visit(documentAST, visitInParallel(visitors));
    return errors;
}
function assertValidSDL(documentAST) {
    const errors = validateSDL(documentAST);
    if (errors.length !== 0) {
        throw new Error(errors.map((error)=>error.message).join('\n\n'));
    }
}
function assertValidSDLExtension(documentAST, schema) {
    const errors = validateSDL(documentAST, schema);
    if (errors.length !== 0) {
        throw new Error(errors.map((error)=>error.message).join('\n\n'));
    }
}
function memoize3(fn) {
    let cache0;
    function memoized(a1, a2, a3) {
        if (!cache0) {
            cache0 = new WeakMap();
        }
        let cache1 = cache0.get(a1);
        let cache2;
        if (cache1) {
            cache2 = cache1.get(a2);
            if (cache2) {
                const cachedValue = cache2.get(a3);
                if (cachedValue !== undefined) {
                    return cachedValue;
                }
            }
        } else {
            cache1 = new WeakMap();
            cache0.set(a1, cache1);
        }
        if (!cache2) {
            cache2 = new WeakMap();
            cache1.set(a2, cache2);
        }
        const newValue = fn(a1, a2, a3);
        cache2.set(a3, newValue);
        return newValue;
    }
    return memoized;
}
function promiseReduce(values, callback, initialValue) {
    return values.reduce((previous, value)=>isPromise(previous) ? previous.then((resolved)=>callback(resolved, value)) : callback(previous, value), initialValue);
}
function promiseForObject(object) {
    const keys = Object.keys(object);
    const valuesAndPromises = keys.map((name)=>object[name]);
    return Promise.all(valuesAndPromises).then((values)=>values.reduce((resolvedObject, value, i)=>{
            resolvedObject[keys[i]] = value;
            return resolvedObject;
        }, Object.create(null)));
}
function addPath(prev, key) {
    return {
        prev,
        key
    };
}
function pathToArray(path) {
    const flattened = [];
    let curr = path;
    while(curr){
        flattened.push(curr.key);
        curr = curr.prev;
    }
    return flattened.reverse();
}
function getOperationRootType(schema, operation) {
    if (operation.operation === 'query') {
        const queryType = schema.getQueryType();
        if (!queryType) {
            throw new GraphQLError('Schema does not define the required query root type.', operation);
        }
        return queryType;
    }
    if (operation.operation === 'mutation') {
        const mutationType = schema.getMutationType();
        if (!mutationType) {
            throw new GraphQLError('Schema is not configured for mutations.', operation);
        }
        return mutationType;
    }
    if (operation.operation === 'subscription') {
        const subscriptionType = schema.getSubscriptionType();
        if (!subscriptionType) {
            throw new GraphQLError('Schema is not configured for subscriptions.', operation);
        }
        return subscriptionType;
    }
    throw new GraphQLError('Can only have query, mutation and subscription operations.', operation);
}
function printPathArray(path) {
    return path.map((key)=>typeof key === 'number' ? '[' + key.toString() + ']' : '.' + key).join('');
}
function valueFromAST(valueNode, type, variables) {
    if (!valueNode) {
        return;
    }
    if (valueNode.kind === Kind.VARIABLE) {
        const variableName = valueNode.name.value;
        if (variables == null || variables[variableName] === undefined) {
            return;
        }
        const variableValue = variables[variableName];
        if (variableValue === null && isNonNullType(type)) {
            return;
        }
        return variableValue;
    }
    if (isNonNullType(type)) {
        if (valueNode.kind === Kind.NULL) {
            return;
        }
        return valueFromAST(valueNode, type.ofType, variables);
    }
    if (valueNode.kind === Kind.NULL) {
        return null;
    }
    if (isListType(type)) {
        const itemType = type.ofType;
        if (valueNode.kind === Kind.LIST) {
            const coercedValues = [];
            for (const itemNode of valueNode.values){
                if (isMissingVariable(itemNode, variables)) {
                    if (isNonNullType(itemType)) {
                        return;
                    }
                    coercedValues.push(null);
                } else {
                    const itemValue = valueFromAST(itemNode, itemType, variables);
                    if (itemValue === undefined) {
                        return;
                    }
                    coercedValues.push(itemValue);
                }
            }
            return coercedValues;
        }
        const coercedValue = valueFromAST(valueNode, itemType, variables);
        if (coercedValue === undefined) {
            return;
        }
        return [
            coercedValue
        ];
    }
    if (isInputObjectType(type)) {
        if (valueNode.kind !== Kind.OBJECT) {
            return;
        }
        const coercedObj = Object.create(null);
        const fieldNodes = keyMap(valueNode.fields, (field)=>field.name.value);
        for (const field of objectValues(type.getFields())){
            const fieldNode = fieldNodes[field.name];
            if (!fieldNode || isMissingVariable(fieldNode.value, variables)) {
                if (field.defaultValue !== undefined) {
                    coercedObj[field.name] = field.defaultValue;
                } else if (isNonNullType(field.type)) {
                    return;
                }
                continue;
            }
            const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
            if (fieldValue === undefined) {
                return;
            }
            coercedObj[field.name] = fieldValue;
        }
        return coercedObj;
    }
    if (isLeafType(type)) {
        let result;
        try {
            result = type.parseLiteral(valueNode, variables);
        } catch (_error) {
            return;
        }
        if (result === undefined) {
            return;
        }
        return result;
    }
    invariant(false, 'Unexpected input type: ' + inspect(type));
}
function isMissingVariable(valueNode, variables) {
    return valueNode.kind === Kind.VARIABLE && (variables == null || variables[valueNode.name.value] === undefined);
}
function coerceInputValue(inputValue, type, onError = defaultOnError) {
    return coerceInputValueImpl(inputValue, type, onError);
}
function defaultOnError(path, invalidValue, error) {
    let errorPrefix = 'Invalid value ' + inspect(invalidValue);
    if (path.length > 0) {
        errorPrefix += ` at "value${printPathArray(path)}"`;
    }
    error.message = errorPrefix + ': ' + error.message;
    throw error;
}
function coerceInputValueImpl(inputValue, type, onError, path) {
    if (isNonNullType(type)) {
        if (inputValue != null) {
            return coerceInputValueImpl(inputValue, type.ofType, onError, path);
        }
        onError(pathToArray(path), inputValue, new GraphQLError(`Expected non-nullable type "${inspect(type)}" not to be null.`));
        return;
    }
    if (inputValue == null) {
        return null;
    }
    if (isListType(type)) {
        const itemType = type.ofType;
        if (isCollection(inputValue)) {
            return arrayFrom(inputValue, (itemValue, index)=>{
                const itemPath = addPath(path, index);
                return coerceInputValueImpl(itemValue, itemType, onError, itemPath);
            });
        }
        return [
            coerceInputValueImpl(inputValue, itemType, onError, path)
        ];
    }
    if (isInputObjectType(type)) {
        if (!isObjectLike(inputValue)) {
            onError(pathToArray(path), inputValue, new GraphQLError(`Expected type "${type.name}" to be an object.`));
            return;
        }
        const coercedValue = {};
        const fieldDefs = type.getFields();
        for (const field of objectValues(fieldDefs)){
            const fieldValue = inputValue[field.name];
            if (fieldValue === undefined) {
                if (field.defaultValue !== undefined) {
                    coercedValue[field.name] = field.defaultValue;
                } else if (isNonNullType(field.type)) {
                    const typeStr = inspect(field.type);
                    onError(pathToArray(path), inputValue, new GraphQLError(`Field "${field.name}" of required type "${typeStr}" was not provided.`));
                }
                continue;
            }
            coercedValue[field.name] = coerceInputValueImpl(fieldValue, field.type, onError, addPath(path, field.name));
        }
        for (const fieldName of Object.keys(inputValue)){
            if (!fieldDefs[fieldName]) {
                const suggestions = suggestionList(fieldName, Object.keys(type.getFields()));
                onError(pathToArray(path), inputValue, new GraphQLError(`Field "${fieldName}" is not defined by type "${type.name}".` + didYouMean(suggestions)));
            }
        }
        return coercedValue;
    }
    if (isLeafType(type)) {
        let parseResult;
        try {
            parseResult = type.parseValue(inputValue);
        } catch (error) {
            if (error instanceof GraphQLError) {
                onError(pathToArray(path), inputValue, error);
            } else {
                onError(pathToArray(path), inputValue, new GraphQLError(`Expected type "${type.name}". ` + error.message, undefined, undefined, undefined, undefined, error));
            }
            return;
        }
        if (parseResult === undefined) {
            onError(pathToArray(path), inputValue, new GraphQLError(`Expected type "${type.name}".`));
        }
        return parseResult;
    }
    invariant(false, 'Unexpected input type: ' + inspect(type));
}
function getVariableValues(schema, varDefNodes, inputs, options) {
    const errors = [];
    const maxErrors = options?.maxErrors;
    try {
        const coerced = coerceVariableValues(schema, varDefNodes, inputs, (error)=>{
            if (maxErrors != null && errors.length >= maxErrors) {
                throw new GraphQLError('Too many errors processing variables, error limit reached. Execution aborted.');
            }
            errors.push(error);
        });
        if (errors.length === 0) {
            return {
                coerced
            };
        }
    } catch (error) {
        errors.push(error);
    }
    return {
        errors
    };
}
function coerceVariableValues(schema, varDefNodes, inputs, onError) {
    const coercedValues = {};
    for (const varDefNode of varDefNodes){
        const varName = varDefNode.variable.name.value;
        const varType = typeFromAST(schema, varDefNode.type);
        if (!isInputType(varType)) {
            const varTypeStr = print(varDefNode.type);
            onError(new GraphQLError(`Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`, varDefNode.type));
            continue;
        }
        if (!hasOwnProperty(inputs, varName)) {
            if (varDefNode.defaultValue) {
                coercedValues[varName] = valueFromAST(varDefNode.defaultValue, varType);
            } else if (isNonNullType(varType)) {
                const varTypeStr1 = inspect(varType);
                onError(new GraphQLError(`Variable "$${varName}" of required type "${varTypeStr1}" was not provided.`, varDefNode));
            }
            continue;
        }
        const value = inputs[varName];
        if (value === null && isNonNullType(varType)) {
            const varTypeStr2 = inspect(varType);
            onError(new GraphQLError(`Variable "$${varName}" of non-null type "${varTypeStr2}" must not be null.`, varDefNode));
            continue;
        }
        coercedValues[varName] = coerceInputValue(value, varType, (path, invalidValue, error)=>{
            let prefix = `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
            if (path.length > 0) {
                prefix += ` at "${varName}${printPathArray(path)}"`;
            }
            onError(new GraphQLError(prefix + '; ' + error.message, varDefNode, undefined, undefined, undefined, error.originalError));
        });
    }
    return coercedValues;
}
function getArgumentValues(def, node, variableValues) {
    const coercedValues = {};
    const argumentNodes = node.arguments ?? [];
    const argNodeMap = keyMap(argumentNodes, (arg)=>arg.name.value);
    for (const argDef of def.args){
        const name = argDef.name;
        const argType = argDef.type;
        const argumentNode = argNodeMap[name];
        if (!argumentNode) {
            if (argDef.defaultValue !== undefined) {
                coercedValues[name] = argDef.defaultValue;
            } else if (isNonNullType(argType)) {
                throw new GraphQLError(`Argument "${name}" of required type "${inspect(argType)}" ` + 'was not provided.', node);
            }
            continue;
        }
        const valueNode = argumentNode.value;
        let isNull = valueNode.kind === Kind.NULL;
        if (valueNode.kind === Kind.VARIABLE) {
            const variableName = valueNode.name.value;
            if (variableValues == null || !hasOwnProperty(variableValues, variableName)) {
                if (argDef.defaultValue !== undefined) {
                    coercedValues[name] = argDef.defaultValue;
                } else if (isNonNullType(argType)) {
                    throw new GraphQLError(`Argument "${name}" of required type "${inspect(argType)}" ` + `was provided the variable "$${variableName}" which was not provided a runtime value.`, valueNode);
                }
                continue;
            }
            isNull = variableValues[variableName] == null;
        }
        if (isNull && isNonNullType(argType)) {
            throw new GraphQLError(`Argument "${name}" of non-null type "${inspect(argType)}" ` + 'must not be null.', valueNode);
        }
        const coercedValue = valueFromAST(valueNode, argType, variableValues);
        if (coercedValue === undefined) {
            throw new GraphQLError(`Argument "${name}" has invalid value ${print(valueNode)}.`, valueNode);
        }
        coercedValues[name] = coercedValue;
    }
    return coercedValues;
}
function getDirectiveValues(directiveDef, node, variableValues) {
    const directiveNode = node.directives && find(node.directives, (directive)=>directive.name.value === directiveDef.name);
    if (directiveNode) {
        return getArgumentValues(directiveDef, directiveNode, variableValues);
    }
}
function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}
function execute(argsOrSchema, document, rootValue, contextValue, variableValues, operationName, fieldResolver, typeResolver) {
    return arguments.length === 1 ? executeImpl(argsOrSchema) : executeImpl({
        schema: argsOrSchema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver
    });
}
function executeImpl(args) {
    const { schema , document , rootValue , contextValue , variableValues , operationName , fieldResolver , typeResolver  } = args;
    assertValidExecutionArguments(schema, document, variableValues);
    const exeContext = buildExecutionContext(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver, typeResolver);
    if (Array.isArray(exeContext)) {
        return {
            errors: exeContext
        };
    }
    const data = executeOperation(exeContext, exeContext.operation, rootValue);
    return buildResponse(exeContext, data);
}
function buildResponse(exeContext, data) {
    if (isPromise(data)) {
        return data.then((resolved)=>buildResponse(exeContext, resolved));
    }
    return exeContext.errors.length === 0 ? {
        data
    } : {
        errors: exeContext.errors,
        data
    };
}
function assertValidExecutionArguments(schema, document, rawVariableValues) {
    devAssert(document, 'Must provide document.');
    assertValidSchema(schema);
    devAssert(rawVariableValues == null || isObjectLike(rawVariableValues), 'Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided.');
}
function buildExecutionContext(schema, document, rootValue, contextValue, rawVariableValues, operationName, fieldResolver, typeResolver) {
    let operation;
    const fragments = Object.create(null);
    for (const definition of document.definitions){
        switch(definition.kind){
            case Kind.OPERATION_DEFINITION:
                if (operationName == null) {
                    if (operation !== undefined) {
                        return [
                            new GraphQLError('Must provide operation name if query contains multiple operations.')
                        ];
                    }
                    operation = definition;
                } else if (definition.name?.value === operationName) {
                    operation = definition;
                }
                break;
            case Kind.FRAGMENT_DEFINITION:
                fragments[definition.name.value] = definition;
                break;
        }
    }
    if (!operation) {
        if (operationName != null) {
            return [
                new GraphQLError(`Unknown operation named "${operationName}".`)
            ];
        }
        return [
            new GraphQLError('Must provide an operation.')
        ];
    }
    const variableDefinitions = operation.variableDefinitions ?? [];
    const coercedVariableValues = getVariableValues(schema, variableDefinitions, rawVariableValues ?? {}, {
        maxErrors: 50
    });
    if (coercedVariableValues.errors) {
        return coercedVariableValues.errors;
    }
    return {
        schema,
        fragments,
        rootValue,
        contextValue,
        operation,
        variableValues: coercedVariableValues.coerced,
        fieldResolver: fieldResolver ?? defaultFieldResolver,
        typeResolver: typeResolver ?? defaultTypeResolver,
        errors: []
    };
}
function executeOperation(exeContext, operation, rootValue) {
    const type = getOperationRootType(exeContext.schema, operation);
    const fields = collectFields(exeContext, type, operation.selectionSet, Object.create(null), Object.create(null));
    const path = undefined;
    try {
        const result = operation.operation === 'mutation' ? executeFieldsSerially(exeContext, type, rootValue, path, fields) : executeFields(exeContext, type, rootValue, path, fields);
        if (isPromise(result)) {
            return result.then(undefined, (error)=>{
                exeContext.errors.push(error);
                return Promise.resolve(null);
            });
        }
        return result;
    } catch (error) {
        exeContext.errors.push(error);
        return null;
    }
}
function executeFieldsSerially(exeContext, parentType, sourceValue, path, fields) {
    return promiseReduce(Object.keys(fields), (results, responseName)=>{
        const fieldNodes = fields[responseName];
        const fieldPath = addPath(path, responseName);
        const result = resolveField(exeContext, parentType, sourceValue, fieldNodes, fieldPath);
        if (result === undefined) {
            return results;
        }
        if (isPromise(result)) {
            return result.then((resolvedResult)=>{
                results[responseName] = resolvedResult;
                return results;
            });
        }
        results[responseName] = result;
        return results;
    }, Object.create(null));
}
function executeFields(exeContext, parentType, sourceValue, path, fields) {
    const results = Object.create(null);
    let containsPromise = false;
    for (const responseName of Object.keys(fields)){
        const fieldNodes = fields[responseName];
        const fieldPath = addPath(path, responseName);
        const result = resolveField(exeContext, parentType, sourceValue, fieldNodes, fieldPath);
        if (result !== undefined) {
            results[responseName] = result;
            if (!containsPromise && isPromise(result)) {
                containsPromise = true;
            }
        }
    }
    if (!containsPromise) {
        return results;
    }
    return promiseForObject(results);
}
function collectFields(exeContext, runtimeType, selectionSet, fields, visitedFragmentNames) {
    for (const selection of selectionSet.selections){
        switch(selection.kind){
            case Kind.FIELD:
                {
                    if (!shouldIncludeNode(exeContext, selection)) {
                        continue;
                    }
                    const name = getFieldEntryKey(selection);
                    if (!fields[name]) {
                        fields[name] = [];
                    }
                    fields[name].push(selection);
                    break;
                }
            case Kind.INLINE_FRAGMENT:
                {
                    if (!shouldIncludeNode(exeContext, selection) || !doesFragmentConditionMatch(exeContext, selection, runtimeType)) {
                        continue;
                    }
                    collectFields(exeContext, runtimeType, selection.selectionSet, fields, visitedFragmentNames);
                    break;
                }
            case Kind.FRAGMENT_SPREAD:
                {
                    const fragName = selection.name.value;
                    if (visitedFragmentNames[fragName] || !shouldIncludeNode(exeContext, selection)) {
                        continue;
                    }
                    visitedFragmentNames[fragName] = true;
                    const fragment = exeContext.fragments[fragName];
                    if (!fragment || !doesFragmentConditionMatch(exeContext, fragment, runtimeType)) {
                        continue;
                    }
                    collectFields(exeContext, runtimeType, fragment.selectionSet, fields, visitedFragmentNames);
                    break;
                }
        }
    }
    return fields;
}
function shouldIncludeNode(exeContext, node) {
    const skip = getDirectiveValues(GraphQLSkipDirective, node, exeContext.variableValues);
    if (skip?.if === true) {
        return false;
    }
    const include = getDirectiveValues(GraphQLIncludeDirective, node, exeContext.variableValues);
    if (include?.if === false) {
        return false;
    }
    return true;
}
function doesFragmentConditionMatch(exeContext, fragment, type) {
    const typeConditionNode = fragment.typeCondition;
    if (!typeConditionNode) {
        return true;
    }
    const conditionalType = typeFromAST(exeContext.schema, typeConditionNode);
    if (conditionalType === type) {
        return true;
    }
    if (isAbstractType(conditionalType)) {
        return exeContext.schema.isSubType(conditionalType, type);
    }
    return false;
}
function getFieldEntryKey(node) {
    return node.alias ? node.alias.value : node.name.value;
}
function resolveField(exeContext, parentType, source, fieldNodes, path) {
    const fieldNode = fieldNodes[0];
    const fieldName = fieldNode.name.value;
    const fieldDef = getFieldDef1(exeContext.schema, parentType, fieldName);
    if (!fieldDef) {
        return;
    }
    const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;
    const info = buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path);
    const result = resolveFieldValueOrError(exeContext, fieldDef, fieldNodes, resolveFn, source, info);
    return completeValueCatchingError(exeContext, fieldDef.type, fieldNodes, info, path, result);
}
function buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path) {
    return {
        fieldName: fieldDef.name,
        fieldNodes,
        returnType: fieldDef.type,
        parentType,
        path,
        schema: exeContext.schema,
        fragments: exeContext.fragments,
        rootValue: exeContext.rootValue,
        operation: exeContext.operation,
        variableValues: exeContext.variableValues
    };
}
function resolveFieldValueOrError(exeContext, fieldDef, fieldNodes, resolveFn, source, info) {
    try {
        const args = getArgumentValues(fieldDef, fieldNodes[0], exeContext.variableValues);
        const contextValue = exeContext.contextValue;
        const result = resolveFn(source, args, contextValue, info);
        return isPromise(result) ? result.then(undefined, asErrorInstance) : result;
    } catch (error) {
        return asErrorInstance(error);
    }
}
function asErrorInstance(error) {
    if (error instanceof Error) {
        return error;
    }
    return new Error('Unexpected error value: ' + inspect(error));
}
function completeValueCatchingError(exeContext, returnType, fieldNodes, info, path, result) {
    try {
        let completed;
        if (isPromise(result)) {
            completed = result.then((resolved)=>completeValue(exeContext, returnType, fieldNodes, info, path, resolved));
        } else {
            completed = completeValue(exeContext, returnType, fieldNodes, info, path, result);
        }
        if (isPromise(completed)) {
            return completed.then(undefined, (error)=>handleFieldError(error, fieldNodes, path, returnType, exeContext));
        }
        return completed;
    } catch (error) {
        return handleFieldError(error, fieldNodes, path, returnType, exeContext);
    }
}
function handleFieldError(rawError, fieldNodes, path, returnType, exeContext) {
    const error = locatedError(asErrorInstance(rawError), fieldNodes, pathToArray(path));
    if (isNonNullType(returnType)) {
        throw error;
    }
    exeContext.errors.push(error);
    return null;
}
function completeValue(exeContext, returnType, fieldNodes, info, path, result) {
    if (result instanceof Error) {
        throw result;
    }
    if (isNonNullType(returnType)) {
        const completed = completeValue(exeContext, returnType.ofType, fieldNodes, info, path, result);
        if (completed === null) {
            throw new Error(`Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`);
        }
        return completed;
    }
    if (result == null) {
        return null;
    }
    if (isListType(returnType)) {
        return completeListValue(exeContext, returnType, fieldNodes, info, path, result);
    }
    if (isLeafType(returnType)) {
        return completeLeafValue(returnType, result);
    }
    if (isAbstractType(returnType)) {
        return completeAbstractValue(exeContext, returnType, fieldNodes, info, path, result);
    }
    if (isObjectType(returnType)) {
        return completeObjectValue(exeContext, returnType, fieldNodes, info, path, result);
    }
    invariant(false, 'Cannot complete value of unexpected output type: ' + inspect(returnType));
}
function completeListValue(exeContext, returnType, fieldNodes, info, path, result) {
    if (!isCollection(result)) {
        throw new GraphQLError(`Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`);
    }
    const itemType = returnType.ofType;
    let containsPromise = false;
    const completedResults = arrayFrom(result, (item, index)=>{
        const fieldPath = addPath(path, index);
        const completedItem = completeValueCatchingError(exeContext, itemType, fieldNodes, info, fieldPath, item);
        if (!containsPromise && isPromise(completedItem)) {
            containsPromise = true;
        }
        return completedItem;
    });
    return containsPromise ? Promise.all(completedResults) : completedResults;
}
function completeLeafValue(returnType, result) {
    const serializedResult = returnType.serialize(result);
    if (serializedResult === undefined) {
        throw new Error(`Expected a value of type "${inspect(returnType)}" but ` + `received: ${inspect(result)}`);
    }
    return serializedResult;
}
function completeAbstractValue(exeContext, returnType, fieldNodes, info, path, result) {
    const resolveTypeFn = returnType.resolveType ?? exeContext.typeResolver;
    const contextValue = exeContext.contextValue;
    const runtimeType = resolveTypeFn(result, contextValue, info, returnType);
    if (isPromise(runtimeType)) {
        return runtimeType.then((resolvedRuntimeType)=>completeObjectValue(exeContext, ensureValidRuntimeType(resolvedRuntimeType, exeContext, returnType, fieldNodes, info, result), fieldNodes, info, path, result));
    }
    return completeObjectValue(exeContext, ensureValidRuntimeType(runtimeType, exeContext, returnType, fieldNodes, info, result), fieldNodes, info, path, result);
}
function ensureValidRuntimeType(runtimeTypeOrName, exeContext, returnType, fieldNodes, info, result) {
    const runtimeType = typeof runtimeTypeOrName === 'string' ? exeContext.schema.getType(runtimeTypeOrName) : runtimeTypeOrName;
    if (!isObjectType(runtimeType)) {
        throw new GraphQLError(`Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` + `value ${inspect(result)}, received "${inspect(runtimeType)}". ` + `Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`, fieldNodes);
    }
    if (!exeContext.schema.isSubType(returnType, runtimeType)) {
        throw new GraphQLError(`Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`, fieldNodes);
    }
    return runtimeType;
}
function completeObjectValue(exeContext, returnType, fieldNodes, info, path, result) {
    if (returnType.isTypeOf) {
        const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);
        if (isPromise(isTypeOf)) {
            return isTypeOf.then((resolvedIsTypeOf)=>{
                if (!resolvedIsTypeOf) {
                    throw invalidReturnTypeError(returnType, result, fieldNodes);
                }
                return collectAndExecuteSubfields(exeContext, returnType, fieldNodes, path, result);
            });
        }
        if (!isTypeOf) {
            throw invalidReturnTypeError(returnType, result, fieldNodes);
        }
    }
    return collectAndExecuteSubfields(exeContext, returnType, fieldNodes, path, result);
}
function invalidReturnTypeError(returnType, result, fieldNodes) {
    return new GraphQLError(`Expected value of type "${returnType.name}" but got: ${inspect(result)}.`, fieldNodes);
}
function collectAndExecuteSubfields(exeContext, returnType, fieldNodes, path, result) {
    const subFieldNodes = collectSubfields(exeContext, returnType, fieldNodes);
    return executeFields(exeContext, returnType, result, path, subFieldNodes);
}
const collectSubfields = memoize3(_collectSubfields);
function _collectSubfields(exeContext, returnType, fieldNodes) {
    let subFieldNodes = Object.create(null);
    const visitedFragmentNames = Object.create(null);
    for (const node of fieldNodes){
        if (node.selectionSet) {
            subFieldNodes = collectFields(exeContext, returnType, node.selectionSet, subFieldNodes, visitedFragmentNames);
        }
    }
    return subFieldNodes;
}
const defaultTypeResolver = function(value, contextValue, info, abstractType) {
    if (isObjectLike(value) && typeof value.__typename === 'string') {
        return value.__typename;
    }
    const possibleTypes = info.schema.getPossibleTypes(abstractType);
    const promisedIsTypeOfResults = [];
    for(let i = 0; i < possibleTypes.length; i++){
        const type = possibleTypes[i];
        if (type.isTypeOf) {
            const isTypeOfResult = type.isTypeOf(value, contextValue, info);
            if (isPromise(isTypeOfResult)) {
                promisedIsTypeOfResults[i] = isTypeOfResult;
            } else if (isTypeOfResult) {
                return type;
            }
        }
    }
    if (promisedIsTypeOfResults.length) {
        return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults)=>{
            for(let i = 0; i < isTypeOfResults.length; i++){
                if (isTypeOfResults[i]) {
                    return possibleTypes[i];
                }
            }
        });
    }
};
const defaultFieldResolver = function(source, args, contextValue, info) {
    if (isObjectLike(source) || typeof source === 'function') {
        const property = source[info.fieldName];
        if (typeof property === 'function') {
            return source[info.fieldName](args, contextValue, info);
        }
        return property;
    }
};
function getFieldDef1(schema, parentType, fieldName) {
    if (fieldName === SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
        return SchemaMetaFieldDef;
    } else if (fieldName === TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
        return TypeMetaFieldDef;
    } else if (fieldName === TypeNameMetaFieldDef.name) {
        return TypeNameMetaFieldDef;
    }
    return parentType.getFields()[fieldName];
}
function graphql(argsOrSchema, source, rootValue, contextValue, variableValues, operationName, fieldResolver, typeResolver) {
    return new Promise((resolve)=>resolve(arguments.length === 1 ? graphqlImpl(argsOrSchema) : graphqlImpl({
            schema: argsOrSchema,
            source,
            rootValue,
            contextValue,
            variableValues,
            operationName,
            fieldResolver,
            typeResolver
        })));
}
function graphqlSync(argsOrSchema, source, rootValue, contextValue, variableValues, operationName, fieldResolver, typeResolver) {
    const result = arguments.length === 1 ? graphqlImpl(argsOrSchema) : graphqlImpl({
        schema: argsOrSchema,
        source,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver
    });
    if (isPromise(result)) {
        throw new Error('GraphQL execution failed to complete synchronously.');
    }
    return result;
}
function graphqlImpl(args) {
    const { schema , source , rootValue , contextValue , variableValues , operationName , fieldResolver , typeResolver  } = args;
    const schemaValidationErrors = validateSchema(schema);
    if (schemaValidationErrors.length > 0) {
        return {
            errors: schemaValidationErrors
        };
    }
    let document;
    try {
        document = parse4(source);
    } catch (syntaxError) {
        return {
            errors: [
                syntaxError
            ]
        };
    }
    const validationErrors = validate(schema, document);
    if (validationErrors.length > 0) {
        return {
            errors: validationErrors
        };
    }
    return execute({
        schema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver
    });
}
function mapAsyncIterator(iterable, callback, rejectCallback) {
    const iteratorMethod = iterable[SYMBOL_ASYNC_ITERATOR];
    const iterator = iteratorMethod.call(iterable);
    let $return;
    let abruptClose;
    if (typeof iterator.return === 'function') {
        $return = iterator.return;
        abruptClose = (error)=>{
            const rethrow = ()=>Promise.reject(error);
            return $return.call(iterator).then(rethrow, rethrow);
        };
    }
    function mapResult(result) {
        return result.done ? result : asyncMapValue(result.value, callback).then(iteratorResult, abruptClose);
    }
    let mapReject;
    if (rejectCallback) {
        const reject = rejectCallback;
        mapReject = (error)=>asyncMapValue(error, reject).then(iteratorResult, abruptClose);
    }
    return {
        next () {
            return iterator.next().then(mapResult, mapReject);
        },
        return () {
            return $return ? $return.call(iterator).then(mapResult, mapReject) : Promise.resolve({
                value: undefined,
                done: true
            });
        },
        throw (error) {
            if (typeof iterator.throw === 'function') {
                return iterator.throw(error).then(mapResult, mapReject);
            }
            return Promise.reject(error).catch(abruptClose);
        },
        [SYMBOL_ASYNC_ITERATOR] () {
            return this;
        }
    };
}
function asyncMapValue(value, callback) {
    return new Promise((resolve)=>resolve(callback(value)));
}
function iteratorResult(value) {
    return {
        value,
        done: false
    };
}
function subscribe(argsOrSchema, document, rootValue, contextValue, variableValues, operationName, fieldResolver, subscribeFieldResolver) {
    return arguments.length === 1 ? subscribeImpl(argsOrSchema) : subscribeImpl({
        schema: argsOrSchema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        subscribeFieldResolver
    });
}
function reportGraphQLError(error) {
    if (error instanceof GraphQLError) {
        return {
            errors: [
                error
            ]
        };
    }
    throw error;
}
function subscribeImpl(args) {
    const { schema , document , rootValue , contextValue , variableValues , operationName , fieldResolver , subscribeFieldResolver  } = args;
    const sourcePromise = createSourceEventStream(schema, document, rootValue, contextValue, variableValues, operationName, subscribeFieldResolver);
    const mapSourceToResponse = (payload)=>execute({
            schema,
            document,
            rootValue: payload,
            contextValue,
            variableValues,
            operationName,
            fieldResolver
        });
    return sourcePromise.then((resultOrStream)=>isAsyncIterable(resultOrStream) ? mapAsyncIterator(resultOrStream, mapSourceToResponse, reportGraphQLError) : resultOrStream);
}
function createSourceEventStream(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver) {
    assertValidExecutionArguments(schema, document, variableValues);
    try {
        const exeContext = buildExecutionContext(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);
        if (Array.isArray(exeContext)) {
            return Promise.resolve({
                errors: exeContext
            });
        }
        const type = getOperationRootType(schema, exeContext.operation);
        const fields = collectFields(exeContext, type, exeContext.operation.selectionSet, Object.create(null), Object.create(null));
        const responseNames = Object.keys(fields);
        const responseName = responseNames[0];
        const fieldNodes = fields[responseName];
        const fieldNode = fieldNodes[0];
        const fieldName = fieldNode.name.value;
        const fieldDef = getFieldDef1(schema, type, fieldName);
        if (!fieldDef) {
            throw new GraphQLError(`The subscription field "${fieldName}" is not defined.`, fieldNodes);
        }
        const resolveFn = fieldDef.subscribe ?? exeContext.fieldResolver;
        const path = addPath(undefined, responseName);
        const info = buildResolveInfo(exeContext, fieldDef, fieldNodes, type, path);
        const result = resolveFieldValueOrError(exeContext, fieldDef, fieldNodes, resolveFn, rootValue, info);
        return Promise.resolve(result).then((eventStream)=>{
            if (eventStream instanceof Error) {
                return {
                    errors: [
                        locatedError(eventStream, fieldNodes, pathToArray(path))
                    ]
                };
            }
            if (isAsyncIterable(eventStream)) {
                return eventStream;
            }
            throw new Error('Subscription field must return Async Iterable. ' + `Received: ${inspect(eventStream)}.`);
        });
    } catch (error) {
        return error instanceof GraphQLError ? Promise.resolve({
            errors: [
                error
            ]
        }) : Promise.reject(error);
    }
}
function isAsyncIterable(maybeAsyncIterable) {
    if (maybeAsyncIterable == null || typeof maybeAsyncIterable !== 'object') {
        return false;
    }
    return typeof maybeAsyncIterable[SYMBOL_ASYNC_ITERATOR] === 'function';
}
function formatError(error) {
    devAssert(error, 'Received null or undefined error.');
    const message = error.message ?? 'An unknown error occurred.';
    const locations = error.locations;
    const path = error.path;
    const extensions = error.extensions;
    return extensions ? {
        message,
        locations,
        path,
        extensions
    } : {
        message,
        locations,
        path
    };
}
function getIntrospectionQuery(options) {
    const optionsWithDefault = {
        descriptions: true,
        directiveIsRepeatable: false,
        schemaDescription: false,
        ...options
    };
    const descriptions = optionsWithDefault.descriptions ? 'description' : '';
    const directiveIsRepeatable = optionsWithDefault.directiveIsRepeatable ? 'isRepeatable' : '';
    const schemaDescription = optionsWithDefault.schemaDescription ? descriptions : '';
    return `
    query IntrospectionQuery {
      __schema {
        ${schemaDescription}
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          ...FullType
        }
        directives {
          name
          ${descriptions}
          ${directiveIsRepeatable}
          locations
          args {
            ...InputValue
          }
        }
      }
    }

    fragment FullType on __Type {
      kind
      name
      ${descriptions}
      fields(includeDeprecated: true) {
        name
        ${descriptions}
        args {
          ...InputValue
        }
        type {
          ...TypeRef
        }
        isDeprecated
        deprecationReason
      }
      inputFields {
        ...InputValue
      }
      interfaces {
        ...TypeRef
      }
      enumValues(includeDeprecated: true) {
        name
        ${descriptions}
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        ...TypeRef
      }
    }

    fragment InputValue on __InputValue {
      name
      ${descriptions}
      type { ...TypeRef }
      defaultValue
    }

    fragment TypeRef on __Type {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}
function getOperationAST(documentAST, operationName) {
    let operation = null;
    for (const definition of documentAST.definitions){
        if (definition.kind === Kind.OPERATION_DEFINITION) {
            if (operationName == null) {
                if (operation) {
                    return null;
                }
                operation = definition;
            } else if (definition.name?.value === operationName) {
                return definition;
            }
        }
    }
    return operation;
}
function introspectionFromSchema(schema, options) {
    const optionsWithDefaults = {
        directiveIsRepeatable: true,
        schemaDescription: true,
        ...options
    };
    const document = parse4(getIntrospectionQuery(optionsWithDefaults));
    const result = execute({
        schema,
        document
    });
    invariant(!isPromise(result) && !result.errors && result.data);
    return result.data;
}
function buildClientSchema(introspection, options) {
    devAssert(isObjectLike(introspection) && isObjectLike(introspection.__schema), `Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: ${inspect(introspection)}.`);
    const schemaIntrospection = introspection.__schema;
    const typeMap = keyValMap(schemaIntrospection.types, (typeIntrospection)=>typeIntrospection.name, (typeIntrospection)=>buildType(typeIntrospection));
    for (const stdType of [
        ...specifiedScalarTypes,
        ...introspectionTypes
    ]){
        if (typeMap[stdType.name]) {
            typeMap[stdType.name] = stdType;
        }
    }
    const queryType = schemaIntrospection.queryType ? getObjectType(schemaIntrospection.queryType) : null;
    const mutationType = schemaIntrospection.mutationType ? getObjectType(schemaIntrospection.mutationType) : null;
    const subscriptionType = schemaIntrospection.subscriptionType ? getObjectType(schemaIntrospection.subscriptionType) : null;
    const directives = schemaIntrospection.directives ? schemaIntrospection.directives.map(buildDirective) : [];
    return new GraphQLSchema({
        description: schemaIntrospection.description,
        query: queryType,
        mutation: mutationType,
        subscription: subscriptionType,
        types: objectValues(typeMap),
        directives,
        assumeValid: options?.assumeValid
    });
    function getType(typeRef) {
        if (typeRef.kind === TypeKind.LIST) {
            const itemRef = typeRef.ofType;
            if (!itemRef) {
                throw new Error('Decorated type deeper than introspection query.');
            }
            return GraphQLList(getType(itemRef));
        }
        if (typeRef.kind === TypeKind.NON_NULL) {
            const nullableRef = typeRef.ofType;
            if (!nullableRef) {
                throw new Error('Decorated type deeper than introspection query.');
            }
            const nullableType = getType(nullableRef);
            return GraphQLNonNull(assertNullableType(nullableType));
        }
        return getNamedType(typeRef);
    }
    function getNamedType(typeRef) {
        const typeName = typeRef.name;
        if (!typeName) {
            throw new Error(`Unknown type reference: ${inspect(typeRef)}.`);
        }
        const type = typeMap[typeName];
        if (!type) {
            throw new Error(`Invalid or incomplete schema, unknown type: ${typeName}. Ensure that a full introspection query is used in order to build a client schema.`);
        }
        return type;
    }
    function getObjectType(typeRef) {
        return assertObjectType(getNamedType(typeRef));
    }
    function getInterfaceType(typeRef) {
        return assertInterfaceType(getNamedType(typeRef));
    }
    function buildType(type) {
        if (type != null && type.name != null && type.kind != null) {
            switch(type.kind){
                case TypeKind.SCALAR:
                    return buildScalarDef(type);
                case TypeKind.OBJECT:
                    return buildObjectDef(type);
                case TypeKind.INTERFACE:
                    return buildInterfaceDef(type);
                case TypeKind.UNION:
                    return buildUnionDef(type);
                case TypeKind.ENUM:
                    return buildEnumDef(type);
                case TypeKind.INPUT_OBJECT:
                    return buildInputObjectDef(type);
            }
        }
        const typeStr = inspect(type);
        throw new Error(`Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema: ${typeStr}.`);
    }
    function buildScalarDef(scalarIntrospection) {
        return new GraphQLScalarType({
            name: scalarIntrospection.name,
            description: scalarIntrospection.description
        });
    }
    function buildImplementationsList(implementingIntrospection) {
        if (implementingIntrospection.interfaces === null && implementingIntrospection.kind === TypeKind.INTERFACE) {
            return [];
        }
        if (!implementingIntrospection.interfaces) {
            const implementingIntrospectionStr = inspect(implementingIntrospection);
            throw new Error(`Introspection result missing interfaces: ${implementingIntrospectionStr}.`);
        }
        return implementingIntrospection.interfaces.map(getInterfaceType);
    }
    function buildObjectDef(objectIntrospection) {
        return new GraphQLObjectType({
            name: objectIntrospection.name,
            description: objectIntrospection.description,
            interfaces: ()=>buildImplementationsList(objectIntrospection),
            fields: ()=>buildFieldDefMap(objectIntrospection)
        });
    }
    function buildInterfaceDef(interfaceIntrospection) {
        return new GraphQLInterfaceType({
            name: interfaceIntrospection.name,
            description: interfaceIntrospection.description,
            interfaces: ()=>buildImplementationsList(interfaceIntrospection),
            fields: ()=>buildFieldDefMap(interfaceIntrospection)
        });
    }
    function buildUnionDef(unionIntrospection) {
        if (!unionIntrospection.possibleTypes) {
            const unionIntrospectionStr = inspect(unionIntrospection);
            throw new Error(`Introspection result missing possibleTypes: ${unionIntrospectionStr}.`);
        }
        return new GraphQLUnionType({
            name: unionIntrospection.name,
            description: unionIntrospection.description,
            types: ()=>unionIntrospection.possibleTypes.map(getObjectType)
        });
    }
    function buildEnumDef(enumIntrospection) {
        if (!enumIntrospection.enumValues) {
            const enumIntrospectionStr = inspect(enumIntrospection);
            throw new Error(`Introspection result missing enumValues: ${enumIntrospectionStr}.`);
        }
        return new GraphQLEnumType({
            name: enumIntrospection.name,
            description: enumIntrospection.description,
            values: keyValMap(enumIntrospection.enumValues, (valueIntrospection)=>valueIntrospection.name, (valueIntrospection)=>({
                    description: valueIntrospection.description,
                    deprecationReason: valueIntrospection.deprecationReason
                }))
        });
    }
    function buildInputObjectDef(inputObjectIntrospection) {
        if (!inputObjectIntrospection.inputFields) {
            const inputObjectIntrospectionStr = inspect(inputObjectIntrospection);
            throw new Error(`Introspection result missing inputFields: ${inputObjectIntrospectionStr}.`);
        }
        return new GraphQLInputObjectType({
            name: inputObjectIntrospection.name,
            description: inputObjectIntrospection.description,
            fields: ()=>buildInputValueDefMap(inputObjectIntrospection.inputFields)
        });
    }
    function buildFieldDefMap(typeIntrospection) {
        if (!typeIntrospection.fields) {
            throw new Error(`Introspection result missing fields: ${inspect(typeIntrospection)}.`);
        }
        return keyValMap(typeIntrospection.fields, (fieldIntrospection)=>fieldIntrospection.name, buildField);
    }
    function buildField(fieldIntrospection) {
        const type = getType(fieldIntrospection.type);
        if (!isOutputType(type)) {
            const typeStr = inspect(type);
            throw new Error(`Introspection must provide output type for fields, but received: ${typeStr}.`);
        }
        if (!fieldIntrospection.args) {
            const fieldIntrospectionStr = inspect(fieldIntrospection);
            throw new Error(`Introspection result missing field args: ${fieldIntrospectionStr}.`);
        }
        return {
            description: fieldIntrospection.description,
            deprecationReason: fieldIntrospection.deprecationReason,
            type,
            args: buildInputValueDefMap(fieldIntrospection.args)
        };
    }
    function buildInputValueDefMap(inputValueIntrospections) {
        return keyValMap(inputValueIntrospections, (inputValue)=>inputValue.name, buildInputValue);
    }
    function buildInputValue(inputValueIntrospection) {
        const type = getType(inputValueIntrospection.type);
        if (!isInputType(type)) {
            const typeStr = inspect(type);
            throw new Error(`Introspection must provide input type for arguments, but received: ${typeStr}.`);
        }
        const defaultValue = inputValueIntrospection.defaultValue != null ? valueFromAST(parseValue(inputValueIntrospection.defaultValue), type) : undefined;
        return {
            description: inputValueIntrospection.description,
            type,
            defaultValue
        };
    }
    function buildDirective(directiveIntrospection) {
        if (!directiveIntrospection.args) {
            const directiveIntrospectionStr = inspect(directiveIntrospection);
            throw new Error(`Introspection result missing directive args: ${directiveIntrospectionStr}.`);
        }
        if (!directiveIntrospection.locations) {
            const directiveIntrospectionStr1 = inspect(directiveIntrospection);
            throw new Error(`Introspection result missing directive locations: ${directiveIntrospectionStr1}.`);
        }
        return new GraphQLDirective({
            name: directiveIntrospection.name,
            description: directiveIntrospection.description,
            isRepeatable: directiveIntrospection.isRepeatable,
            locations: directiveIntrospection.locations.slice(),
            args: buildInputValueDefMap(directiveIntrospection.args)
        });
    }
}
function extendSchema(schema, documentAST, options) {
    assertSchema(schema);
    devAssert(documentAST != null && documentAST.kind === Kind.DOCUMENT, 'Must provide valid Document AST.');
    if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
        assertValidSDLExtension(documentAST, schema);
    }
    const schemaConfig = schema.toConfig();
    const extendedConfig = extendSchemaImpl(schemaConfig, documentAST, options);
    return schemaConfig === extendedConfig ? schema : new GraphQLSchema(extendedConfig);
}
function extendSchemaImpl(schemaConfig, documentAST, options) {
    const typeDefs = [];
    const typeExtensionsMap = Object.create(null);
    const directiveDefs = [];
    let schemaDef;
    const schemaExtensions = [];
    for (const def of documentAST.definitions){
        if (def.kind === Kind.SCHEMA_DEFINITION) {
            schemaDef = def;
        } else if (def.kind === Kind.SCHEMA_EXTENSION) {
            schemaExtensions.push(def);
        } else if (isTypeDefinitionNode(def)) {
            typeDefs.push(def);
        } else if (isTypeExtensionNode(def)) {
            const extendedTypeName = def.name.value;
            const existingTypeExtensions = typeExtensionsMap[extendedTypeName];
            typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([
                def
            ]) : [
                def
            ];
        } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
            directiveDefs.push(def);
        }
    }
    if (Object.keys(typeExtensionsMap).length === 0 && typeDefs.length === 0 && directiveDefs.length === 0 && schemaExtensions.length === 0 && schemaDef == null) {
        return schemaConfig;
    }
    const typeMap = Object.create(null);
    for (const existingType of schemaConfig.types){
        typeMap[existingType.name] = extendNamedType(existingType);
    }
    for (const typeNode of typeDefs){
        const name = typeNode.name.value;
        typeMap[name] = stdTypeMap[name] ?? buildType(typeNode);
    }
    const operationTypes = {
        query: schemaConfig.query && replaceNamedType(schemaConfig.query),
        mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
        subscription: schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
        ...schemaDef && getOperationTypes([
            schemaDef
        ]),
        ...getOperationTypes(schemaExtensions)
    };
    return {
        description: schemaDef?.description?.value,
        ...operationTypes,
        types: objectValues(typeMap),
        directives: [
            ...schemaConfig.directives.map(replaceDirective),
            ...directiveDefs.map(buildDirective)
        ],
        extensions: undefined,
        astNode: schemaDef ?? schemaConfig.astNode,
        extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
        assumeValid: options?.assumeValid ?? false
    };
    function replaceType(type) {
        if (isListType(type)) {
            return new GraphQLList(replaceType(type.ofType));
        } else if (isNonNullType(type)) {
            return new GraphQLNonNull(replaceType(type.ofType));
        }
        return replaceNamedType(type);
    }
    function replaceNamedType(type) {
        return typeMap[type.name];
    }
    function replaceDirective(directive) {
        const config = directive.toConfig();
        return new GraphQLDirective({
            ...config,
            args: mapValue(config.args, extendArg)
        });
    }
    function extendNamedType(type) {
        if (isIntrospectionType(type) || isSpecifiedScalarType(type)) {
            return type;
        }
        if (isScalarType(type)) {
            return extendScalarType(type);
        }
        if (isObjectType(type)) {
            return extendObjectType(type);
        }
        if (isInterfaceType(type)) {
            return extendInterfaceType(type);
        }
        if (isUnionType(type)) {
            return extendUnionType(type);
        }
        if (isEnumType(type)) {
            return extendEnumType(type);
        }
        if (isInputObjectType(type)) {
            return extendInputObjectType(type);
        }
        invariant(false, 'Unexpected type: ' + inspect(type));
    }
    function extendInputObjectType(type) {
        const config = type.toConfig();
        const extensions = typeExtensionsMap[config.name] ?? [];
        return new GraphQLInputObjectType({
            ...config,
            fields: ()=>({
                    ...mapValue(config.fields, (field)=>({
                            ...field,
                            type: replaceType(field.type)
                        })),
                    ...buildInputFieldMap(extensions)
                }),
            extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
    }
    function extendEnumType(type) {
        const config = type.toConfig();
        const extensions = typeExtensionsMap[type.name] ?? [];
        return new GraphQLEnumType({
            ...config,
            values: {
                ...config.values,
                ...buildEnumValueMap(extensions)
            },
            extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
    }
    function extendScalarType(type) {
        const config = type.toConfig();
        const extensions = typeExtensionsMap[config.name] ?? [];
        return new GraphQLScalarType({
            ...config,
            extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
    }
    function extendObjectType(type) {
        const config = type.toConfig();
        const extensions = typeExtensionsMap[config.name] ?? [];
        return new GraphQLObjectType({
            ...config,
            interfaces: ()=>[
                    ...type.getInterfaces().map(replaceNamedType),
                    ...buildInterfaces(extensions)
                ],
            fields: ()=>({
                    ...mapValue(config.fields, extendField),
                    ...buildFieldMap(extensions)
                }),
            extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
    }
    function extendInterfaceType(type) {
        const config = type.toConfig();
        const extensions = typeExtensionsMap[config.name] ?? [];
        return new GraphQLInterfaceType({
            ...config,
            interfaces: ()=>[
                    ...type.getInterfaces().map(replaceNamedType),
                    ...buildInterfaces(extensions)
                ],
            fields: ()=>({
                    ...mapValue(config.fields, extendField),
                    ...buildFieldMap(extensions)
                }),
            extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
    }
    function extendUnionType(type) {
        const config = type.toConfig();
        const extensions = typeExtensionsMap[config.name] ?? [];
        return new GraphQLUnionType({
            ...config,
            types: ()=>[
                    ...type.getTypes().map(replaceNamedType),
                    ...buildUnionTypes(extensions)
                ],
            extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
    }
    function extendField(field) {
        return {
            ...field,
            type: replaceType(field.type),
            args: mapValue(field.args, extendArg)
        };
    }
    function extendArg(arg) {
        return {
            ...arg,
            type: replaceType(arg.type)
        };
    }
    function getOperationTypes(nodes) {
        const opTypes = {};
        for (const node of nodes){
            const operationTypesNodes = node.operationTypes ?? [];
            for (const operationType of operationTypesNodes){
                opTypes[operationType.operation] = getNamedType(operationType.type);
            }
        }
        return opTypes;
    }
    function getNamedType(node) {
        const name = node.name.value;
        const type = stdTypeMap[name] ?? typeMap[name];
        if (type === undefined) {
            throw new Error(`Unknown type: "${name}".`);
        }
        return type;
    }
    function getWrappedType(node) {
        if (node.kind === Kind.LIST_TYPE) {
            return new GraphQLList(getWrappedType(node.type));
        }
        if (node.kind === Kind.NON_NULL_TYPE) {
            return new GraphQLNonNull(getWrappedType(node.type));
        }
        return getNamedType(node);
    }
    function buildDirective(node) {
        const locations = node.locations.map(({ value  })=>value);
        return new GraphQLDirective({
            name: node.name.value,
            description: getDescription(node, options),
            locations,
            isRepeatable: node.repeatable,
            args: buildArgumentMap(node.arguments),
            astNode: node
        });
    }
    function buildFieldMap(nodes) {
        const fieldConfigMap = Object.create(null);
        for (const node of nodes){
            const nodeFields = node.fields ?? [];
            for (const field of nodeFields){
                fieldConfigMap[field.name.value] = {
                    type: getWrappedType(field.type),
                    description: getDescription(field, options),
                    args: buildArgumentMap(field.arguments),
                    deprecationReason: getDeprecationReason(field),
                    astNode: field
                };
            }
        }
        return fieldConfigMap;
    }
    function buildArgumentMap(args) {
        const argsNodes = args ?? [];
        const argConfigMap = Object.create(null);
        for (const arg of argsNodes){
            const type = getWrappedType(arg.type);
            argConfigMap[arg.name.value] = {
                type,
                description: getDescription(arg, options),
                defaultValue: valueFromAST(arg.defaultValue, type),
                astNode: arg
            };
        }
        return argConfigMap;
    }
    function buildInputFieldMap(nodes) {
        const inputFieldMap = Object.create(null);
        for (const node of nodes){
            const fieldsNodes = node.fields ?? [];
            for (const field of fieldsNodes){
                const type = getWrappedType(field.type);
                inputFieldMap[field.name.value] = {
                    type,
                    description: getDescription(field, options),
                    defaultValue: valueFromAST(field.defaultValue, type),
                    astNode: field
                };
            }
        }
        return inputFieldMap;
    }
    function buildEnumValueMap(nodes) {
        const enumValueMap = Object.create(null);
        for (const node of nodes){
            const valuesNodes = node.values ?? [];
            for (const value of valuesNodes){
                enumValueMap[value.name.value] = {
                    description: getDescription(value, options),
                    deprecationReason: getDeprecationReason(value),
                    astNode: value
                };
            }
        }
        return enumValueMap;
    }
    function buildInterfaces(nodes) {
        const interfaces = [];
        for (const node of nodes){
            const interfacesNodes = node.interfaces ?? [];
            for (const type of interfacesNodes){
                interfaces.push(getNamedType(type));
            }
        }
        return interfaces;
    }
    function buildUnionTypes(nodes) {
        const types = [];
        for (const node of nodes){
            const typeNodes = node.types ?? [];
            for (const type of typeNodes){
                types.push(getNamedType(type));
            }
        }
        return types;
    }
    function buildType(astNode) {
        const name = astNode.name.value;
        const description = getDescription(astNode, options);
        const extensionNodes = typeExtensionsMap[name] ?? [];
        switch(astNode.kind){
            case Kind.OBJECT_TYPE_DEFINITION:
                {
                    const extensionASTNodes = extensionNodes;
                    const allNodes = [
                        astNode,
                        ...extensionASTNodes
                    ];
                    return new GraphQLObjectType({
                        name,
                        description,
                        interfaces: ()=>buildInterfaces(allNodes),
                        fields: ()=>buildFieldMap(allNodes),
                        astNode,
                        extensionASTNodes
                    });
                }
            case Kind.INTERFACE_TYPE_DEFINITION:
                {
                    const extensionASTNodes1 = extensionNodes;
                    const allNodes1 = [
                        astNode,
                        ...extensionASTNodes1
                    ];
                    return new GraphQLInterfaceType({
                        name,
                        description,
                        interfaces: ()=>buildInterfaces(allNodes1),
                        fields: ()=>buildFieldMap(allNodes1),
                        astNode,
                        extensionASTNodes: extensionASTNodes1
                    });
                }
            case Kind.ENUM_TYPE_DEFINITION:
                {
                    const extensionASTNodes2 = extensionNodes;
                    const allNodes2 = [
                        astNode,
                        ...extensionASTNodes2
                    ];
                    return new GraphQLEnumType({
                        name,
                        description,
                        values: buildEnumValueMap(allNodes2),
                        astNode,
                        extensionASTNodes: extensionASTNodes2
                    });
                }
            case Kind.UNION_TYPE_DEFINITION:
                {
                    const extensionASTNodes3 = extensionNodes;
                    const allNodes3 = [
                        astNode,
                        ...extensionASTNodes3
                    ];
                    return new GraphQLUnionType({
                        name,
                        description,
                        types: ()=>buildUnionTypes(allNodes3),
                        astNode,
                        extensionASTNodes: extensionASTNodes3
                    });
                }
            case Kind.SCALAR_TYPE_DEFINITION:
                {
                    const extensionASTNodes4 = extensionNodes;
                    return new GraphQLScalarType({
                        name,
                        description,
                        astNode,
                        extensionASTNodes: extensionASTNodes4
                    });
                }
            case Kind.INPUT_OBJECT_TYPE_DEFINITION:
                {
                    const extensionASTNodes5 = extensionNodes;
                    const allNodes4 = [
                        astNode,
                        ...extensionASTNodes5
                    ];
                    return new GraphQLInputObjectType({
                        name,
                        description,
                        fields: ()=>buildInputFieldMap(allNodes4),
                        astNode,
                        extensionASTNodes: extensionASTNodes5
                    });
                }
        }
        invariant(false, 'Unexpected type definition node: ' + inspect(astNode));
    }
}
const stdTypeMap = keyMap(specifiedScalarTypes.concat(introspectionTypes), (type)=>type.name);
function getDeprecationReason(node) {
    const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
    return deprecated?.reason;
}
function getDescription(node, options) {
    if (node.description) {
        return node.description.value;
    }
    if (options?.commentDescriptions === true) {
        const rawValue = getLeadingCommentBlock(node);
        if (rawValue !== undefined) {
            return dedentBlockStringValue('\n' + rawValue);
        }
    }
}
function getLeadingCommentBlock(node) {
    const loc = node.loc;
    if (!loc) {
        return;
    }
    const comments = [];
    let token = loc.startToken.prev;
    while(token != null && token.kind === TokenKind.COMMENT && token.next && token.prev && token.line + 1 === token.next.line && token.line !== token.prev.line){
        const value = String(token.value);
        comments.push(value);
        token = token.prev;
    }
    return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}
function buildASTSchema(documentAST, options) {
    devAssert(documentAST != null && documentAST.kind === Kind.DOCUMENT, 'Must provide valid Document AST.');
    if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
        assertValidSDL(documentAST);
    }
    const config = extendSchemaImpl(emptySchemaConfig, documentAST, options);
    if (config.astNode == null) {
        for (const type of config.types){
            switch(type.name){
                case 'Query':
                    config.query = type;
                    break;
                case 'Mutation':
                    config.mutation = type;
                    break;
                case 'Subscription':
                    config.subscription = type;
                    break;
            }
        }
    }
    const { directives  } = config;
    if (!directives.some((directive)=>directive.name === 'skip')) {
        directives.push(GraphQLSkipDirective);
    }
    if (!directives.some((directive)=>directive.name === 'include')) {
        directives.push(GraphQLIncludeDirective);
    }
    if (!directives.some((directive)=>directive.name === 'deprecated')) {
        directives.push(GraphQLDeprecatedDirective);
    }
    return new GraphQLSchema(config);
}
const emptySchemaConfig = new GraphQLSchema({
    directives: []
}).toConfig();
function buildSchema(source, options) {
    const document = parse4(source, {
        noLocation: options?.noLocation,
        allowLegacySDLEmptyFields: options?.allowLegacySDLEmptyFields,
        allowLegacySDLImplementsInterfaces: options?.allowLegacySDLImplementsInterfaces,
        experimentalFragmentVariables: options?.experimentalFragmentVariables
    });
    return buildASTSchema(document, {
        commentDescriptions: options?.commentDescriptions,
        assumeValidSDL: options?.assumeValidSDL,
        assumeValid: options?.assumeValid
    });
}
function lexicographicSortSchema(schema) {
    const schemaConfig = schema.toConfig();
    const typeMap = keyValMap(sortByName(schemaConfig.types), (type)=>type.name, sortNamedType);
    return new GraphQLSchema({
        ...schemaConfig,
        types: objectValues(typeMap),
        directives: sortByName(schemaConfig.directives).map(sortDirective),
        query: replaceMaybeType(schemaConfig.query),
        mutation: replaceMaybeType(schemaConfig.mutation),
        subscription: replaceMaybeType(schemaConfig.subscription)
    });
    function replaceType(type) {
        if (isListType(type)) {
            return new GraphQLList(replaceType(type.ofType));
        } else if (isNonNullType(type)) {
            return new GraphQLNonNull(replaceType(type.ofType));
        }
        return replaceNamedType(type);
    }
    function replaceNamedType(type) {
        return typeMap[type.name];
    }
    function replaceMaybeType(maybeType) {
        return maybeType && replaceNamedType(maybeType);
    }
    function sortDirective(directive) {
        const config = directive.toConfig();
        return new GraphQLDirective({
            ...config,
            locations: sortBy(config.locations, (x)=>x),
            args: sortArgs(config.args)
        });
    }
    function sortArgs(args) {
        return sortObjMap(args, (arg)=>({
                ...arg,
                type: replaceType(arg.type)
            }));
    }
    function sortFields(fieldsMap) {
        return sortObjMap(fieldsMap, (field)=>({
                ...field,
                type: replaceType(field.type),
                args: sortArgs(field.args)
            }));
    }
    function sortInputFields(fieldsMap) {
        return sortObjMap(fieldsMap, (field)=>({
                ...field,
                type: replaceType(field.type)
            }));
    }
    function sortTypes(arr) {
        return sortByName(arr).map(replaceNamedType);
    }
    function sortNamedType(type) {
        if (isScalarType(type) || isIntrospectionType(type)) {
            return type;
        }
        if (isObjectType(type)) {
            const config = type.toConfig();
            return new GraphQLObjectType({
                ...config,
                interfaces: ()=>sortTypes(config.interfaces),
                fields: ()=>sortFields(config.fields)
            });
        }
        if (isInterfaceType(type)) {
            const config1 = type.toConfig();
            return new GraphQLInterfaceType({
                ...config1,
                interfaces: ()=>sortTypes(config1.interfaces),
                fields: ()=>sortFields(config1.fields)
            });
        }
        if (isUnionType(type)) {
            const config2 = type.toConfig();
            return new GraphQLUnionType({
                ...config2,
                types: ()=>sortTypes(config2.types)
            });
        }
        if (isEnumType(type)) {
            const config3 = type.toConfig();
            return new GraphQLEnumType({
                ...config3,
                values: sortObjMap(config3.values)
            });
        }
        if (isInputObjectType(type)) {
            const config4 = type.toConfig();
            return new GraphQLInputObjectType({
                ...config4,
                fields: ()=>sortInputFields(config4.fields)
            });
        }
        invariant(false, 'Unexpected type: ' + inspect(type));
    }
}
function sortObjMap(map, sortValueFn) {
    const sortedMap = Object.create(null);
    const sortedKeys = sortBy(Object.keys(map), (x)=>x);
    for (const key of sortedKeys){
        const value = map[key];
        sortedMap[key] = sortValueFn ? sortValueFn(value) : value;
    }
    return sortedMap;
}
function sortByName(array) {
    return sortBy(array, (obj)=>obj.name);
}
function sortBy(array, mapToKey) {
    return array.slice().sort((obj1, obj2)=>{
        const key1 = mapToKey(obj1);
        const key2 = mapToKey(obj2);
        return key1.localeCompare(key2);
    });
}
function printSchema(schema, options) {
    return printFilteredSchema(schema, (n)=>!isSpecifiedDirective(n), isDefinedType, options);
}
function printIntrospectionSchema(schema, options) {
    return printFilteredSchema(schema, isSpecifiedDirective, isIntrospectionType, options);
}
function isDefinedType(type) {
    return !isSpecifiedScalarType(type) && !isIntrospectionType(type);
}
function printFilteredSchema(schema, directiveFilter, typeFilter, options) {
    const directives = schema.getDirectives().filter(directiveFilter);
    const types = objectValues(schema.getTypeMap()).filter(typeFilter);
    return [
        printSchemaDefinition(schema)
    ].concat(directives.map((directive)=>printDirective(directive, options)), types.map((type)=>printType(type, options))).filter(Boolean).join('\n\n') + '\n';
}
function printSchemaDefinition(schema) {
    if (schema.description == null && isSchemaOfCommonNames(schema)) {
        return;
    }
    const operationTypes = [];
    const queryType = schema.getQueryType();
    if (queryType) {
        operationTypes.push(`  query: ${queryType.name}`);
    }
    const mutationType = schema.getMutationType();
    if (mutationType) {
        operationTypes.push(`  mutation: ${mutationType.name}`);
    }
    const subscriptionType = schema.getSubscriptionType();
    if (subscriptionType) {
        operationTypes.push(`  subscription: ${subscriptionType.name}`);
    }
    return printDescription({}, schema) + `schema {\n${operationTypes.join('\n')}\n}`;
}
function isSchemaOfCommonNames(schema) {
    const queryType = schema.getQueryType();
    if (queryType && queryType.name !== 'Query') {
        return false;
    }
    const mutationType = schema.getMutationType();
    if (mutationType && mutationType.name !== 'Mutation') {
        return false;
    }
    const subscriptionType = schema.getSubscriptionType();
    if (subscriptionType && subscriptionType.name !== 'Subscription') {
        return false;
    }
    return true;
}
function printType(type, options) {
    if (isScalarType(type)) {
        return printScalar(type, options);
    }
    if (isObjectType(type)) {
        return printObject(type, options);
    }
    if (isInterfaceType(type)) {
        return printInterface(type, options);
    }
    if (isUnionType(type)) {
        return printUnion(type, options);
    }
    if (isEnumType(type)) {
        return printEnum(type, options);
    }
    if (isInputObjectType(type)) {
        return printInputObject(type, options);
    }
    invariant(false, 'Unexpected type: ' + inspect(type));
}
function printScalar(type, options) {
    return printDescription(options, type) + `scalar ${type.name}`;
}
function printImplementedInterfaces(type) {
    const interfaces = type.getInterfaces();
    return interfaces.length ? ' implements ' + interfaces.map((i)=>i.name).join(' & ') : '';
}
function printObject(type, options) {
    return printDescription(options, type) + `type ${type.name}` + printImplementedInterfaces(type) + printFields(options, type);
}
function printInterface(type, options) {
    return printDescription(options, type) + `interface ${type.name}` + printImplementedInterfaces(type) + printFields(options, type);
}
function printUnion(type, options) {
    const types = type.getTypes();
    const possibleTypes = types.length ? ' = ' + types.join(' | ') : '';
    return printDescription(options, type) + 'union ' + type.name + possibleTypes;
}
function printEnum(type, options) {
    const values = type.getValues().map((value, i)=>printDescription(options, value, '  ', !i) + '  ' + value.name + printDeprecated(value));
    return printDescription(options, type) + `enum ${type.name}` + printBlock(values);
}
function printInputObject(type, options) {
    const fields = objectValues(type.getFields()).map((f, i)=>printDescription(options, f, '  ', !i) + '  ' + printInputValue(f));
    return printDescription(options, type) + `input ${type.name}` + printBlock(fields);
}
function printFields(options, type) {
    const fields = objectValues(type.getFields()).map((f, i)=>printDescription(options, f, '  ', !i) + '  ' + f.name + printArgs(options, f.args, '  ') + ': ' + String(f.type) + printDeprecated(f));
    return printBlock(fields);
}
function printBlock(items) {
    return items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '';
}
function printArgs(options, args, indentation = '') {
    if (args.length === 0) {
        return '';
    }
    if (args.every((arg)=>!arg.description)) {
        return '(' + args.map(printInputValue).join(', ') + ')';
    }
    return '(\n' + args.map((arg, i)=>printDescription(options, arg, '  ' + indentation, !i) + '  ' + indentation + printInputValue(arg)).join('\n') + '\n' + indentation + ')';
}
function printInputValue(arg) {
    const defaultAST = astFromValue(arg.defaultValue, arg.type);
    let argDecl = arg.name + ': ' + String(arg.type);
    if (defaultAST) {
        argDecl += ` = ${print(defaultAST)}`;
    }
    return argDecl;
}
function printDirective(directive, options) {
    return printDescription(options, directive) + 'directive @' + directive.name + printArgs(options, directive.args) + (directive.isRepeatable ? ' repeatable' : '') + ' on ' + directive.locations.join(' | ');
}
function printDeprecated(fieldOrEnumVal) {
    if (!fieldOrEnumVal.isDeprecated) {
        return '';
    }
    const reason = fieldOrEnumVal.deprecationReason;
    const reasonAST = astFromValue(reason, GraphQLString);
    if (reasonAST && reason !== DEFAULT_DEPRECATION_REASON) {
        return ' @deprecated(reason: ' + print(reasonAST) + ')';
    }
    return ' @deprecated';
}
function printDescription(options, def, indentation = '', firstInBlock = true) {
    const { description  } = def;
    if (description == null) {
        return '';
    }
    if (options?.commentDescriptions === true) {
        return printDescriptionWithComments(description, indentation, firstInBlock);
    }
    const preferMultipleLines = description.length > 70;
    const blockString = printBlockString(description, '', preferMultipleLines);
    const prefix = indentation && !firstInBlock ? '\n' + indentation : indentation;
    return prefix + blockString.replace(/\n/g, '\n' + indentation) + '\n';
}
function printDescriptionWithComments(description, indentation, firstInBlock) {
    const prefix = indentation && !firstInBlock ? '\n' : '';
    const comment = description.split('\n').map((line)=>indentation + (line !== '' ? '# ' + line : '#')).join('\n');
    return prefix + comment + '\n';
}
function concatAST(asts) {
    return {
        kind: 'Document',
        definitions: flatMap(asts, (ast)=>ast.definitions)
    };
}
function separateOperations(documentAST) {
    const operations = [];
    const depGraph = Object.create(null);
    let fromName;
    visit(documentAST, {
        OperationDefinition (node) {
            fromName = opName(node);
            operations.push(node);
        },
        FragmentDefinition (node) {
            fromName = node.name.value;
        },
        FragmentSpread (node) {
            const toName = node.name.value;
            let dependents = depGraph[fromName];
            if (dependents === undefined) {
                dependents = depGraph[fromName] = Object.create(null);
            }
            dependents[toName] = true;
        }
    });
    const separatedDocumentASTs = Object.create(null);
    for (const operation of operations){
        const operationName = opName(operation);
        const dependencies = Object.create(null);
        collectTransitiveDependencies(dependencies, depGraph, operationName);
        separatedDocumentASTs[operationName] = {
            kind: Kind.DOCUMENT,
            definitions: documentAST.definitions.filter((node)=>node === operation || node.kind === Kind.FRAGMENT_DEFINITION && dependencies[node.name.value])
        };
    }
    return separatedDocumentASTs;
}
function opName(operation) {
    return operation.name ? operation.name.value : '';
}
function collectTransitiveDependencies(collected, depGraph, fromName) {
    const immediateDeps = depGraph[fromName];
    if (immediateDeps) {
        for (const toName of Object.keys(immediateDeps)){
            if (!collected[toName]) {
                collected[toName] = true;
                collectTransitiveDependencies(collected, depGraph, toName);
            }
        }
    }
}
const BreakingChangeType = Object.freeze({
    TYPE_REMOVED: 'TYPE_REMOVED',
    TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND',
    TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION',
    VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM',
    REQUIRED_INPUT_FIELD_ADDED: 'REQUIRED_INPUT_FIELD_ADDED',
    IMPLEMENTED_INTERFACE_REMOVED: 'IMPLEMENTED_INTERFACE_REMOVED',
    FIELD_REMOVED: 'FIELD_REMOVED',
    FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND',
    REQUIRED_ARG_ADDED: 'REQUIRED_ARG_ADDED',
    ARG_REMOVED: 'ARG_REMOVED',
    ARG_CHANGED_KIND: 'ARG_CHANGED_KIND',
    DIRECTIVE_REMOVED: 'DIRECTIVE_REMOVED',
    DIRECTIVE_ARG_REMOVED: 'DIRECTIVE_ARG_REMOVED',
    REQUIRED_DIRECTIVE_ARG_ADDED: 'REQUIRED_DIRECTIVE_ARG_ADDED',
    DIRECTIVE_REPEATABLE_REMOVED: 'DIRECTIVE_REPEATABLE_REMOVED',
    DIRECTIVE_LOCATION_REMOVED: 'DIRECTIVE_LOCATION_REMOVED'
});
const DangerousChangeType = Object.freeze({
    VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM',
    TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION',
    OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED',
    OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED',
    IMPLEMENTED_INTERFACE_ADDED: 'IMPLEMENTED_INTERFACE_ADDED',
    ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE'
});
function findBreakingChanges(oldSchema, newSchema) {
    const breakingChanges = findSchemaChanges(oldSchema, newSchema).filter((change)=>change.type in BreakingChangeType);
    return breakingChanges;
}
function findDangerousChanges(oldSchema, newSchema) {
    const dangerousChanges = findSchemaChanges(oldSchema, newSchema).filter((change)=>change.type in DangerousChangeType);
    return dangerousChanges;
}
function findSchemaChanges(oldSchema, newSchema) {
    return [
        ...findTypeChanges(oldSchema, newSchema),
        ...findDirectiveChanges(oldSchema, newSchema)
    ];
}
function findDirectiveChanges(oldSchema, newSchema) {
    const schemaChanges = [];
    const directivesDiff = diff(oldSchema.getDirectives(), newSchema.getDirectives());
    for (const oldDirective of directivesDiff.removed){
        schemaChanges.push({
            type: BreakingChangeType.DIRECTIVE_REMOVED,
            description: `${oldDirective.name} was removed.`
        });
    }
    for (const [oldDirective1, newDirective] of directivesDiff.persisted){
        const argsDiff = diff(oldDirective1.args, newDirective.args);
        for (const newArg of argsDiff.added){
            if (isRequiredArgument(newArg)) {
                schemaChanges.push({
                    type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
                    description: `A required arg ${newArg.name} on directive ${oldDirective1.name} was added.`
                });
            }
        }
        for (const oldArg of argsDiff.removed){
            schemaChanges.push({
                type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
                description: `${oldArg.name} was removed from ${oldDirective1.name}.`
            });
        }
        if (oldDirective1.isRepeatable && !newDirective.isRepeatable) {
            schemaChanges.push({
                type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
                description: `Repeatable flag was removed from ${oldDirective1.name}.`
            });
        }
        for (const location of oldDirective1.locations){
            if (newDirective.locations.indexOf(location) === -1) {
                schemaChanges.push({
                    type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
                    description: `${location} was removed from ${oldDirective1.name}.`
                });
            }
        }
    }
    return schemaChanges;
}
function findTypeChanges(oldSchema, newSchema) {
    const schemaChanges = [];
    const typesDiff = diff(objectValues(oldSchema.getTypeMap()), objectValues(newSchema.getTypeMap()));
    for (const oldType of typesDiff.removed){
        schemaChanges.push({
            type: BreakingChangeType.TYPE_REMOVED,
            description: isSpecifiedScalarType(oldType) ? `Standard scalar ${oldType.name} was removed because it is not referenced anymore.` : `${oldType.name} was removed.`
        });
    }
    for (const [oldType1, newType] of typesDiff.persisted){
        if (isEnumType(oldType1) && isEnumType(newType)) {
            schemaChanges.push(...findEnumTypeChanges(oldType1, newType));
        } else if (isUnionType(oldType1) && isUnionType(newType)) {
            schemaChanges.push(...findUnionTypeChanges(oldType1, newType));
        } else if (isInputObjectType(oldType1) && isInputObjectType(newType)) {
            schemaChanges.push(...findInputObjectTypeChanges(oldType1, newType));
        } else if (isObjectType(oldType1) && isObjectType(newType)) {
            schemaChanges.push(...findFieldChanges(oldType1, newType), ...findImplementedInterfacesChanges(oldType1, newType));
        } else if (isInterfaceType(oldType1) && isInterfaceType(newType)) {
            schemaChanges.push(...findFieldChanges(oldType1, newType), ...findImplementedInterfacesChanges(oldType1, newType));
        } else if (oldType1.constructor !== newType.constructor) {
            schemaChanges.push({
                type: BreakingChangeType.TYPE_CHANGED_KIND,
                description: `${oldType1.name} changed from ` + `${typeKindName(oldType1)} to ${typeKindName(newType)}.`
            });
        }
    }
    return schemaChanges;
}
function findInputObjectTypeChanges(oldType, newType) {
    const schemaChanges = [];
    const fieldsDiff = diff(objectValues(oldType.getFields()), objectValues(newType.getFields()));
    for (const newField of fieldsDiff.added){
        if (isRequiredInputField(newField)) {
            schemaChanges.push({
                type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
                description: `A required field ${newField.name} on input type ${oldType.name} was added.`
            });
        } else {
            schemaChanges.push({
                type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
                description: `An optional field ${newField.name} on input type ${oldType.name} was added.`
            });
        }
    }
    for (const oldField of fieldsDiff.removed){
        schemaChanges.push({
            type: BreakingChangeType.FIELD_REMOVED,
            description: `${oldType.name}.${oldField.name} was removed.`
        });
    }
    for (const [oldField1, newField1] of fieldsDiff.persisted){
        const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldField1.type, newField1.type);
        if (!isSafe) {
            schemaChanges.push({
                type: BreakingChangeType.FIELD_CHANGED_KIND,
                description: `${oldType.name}.${oldField1.name} changed type from ` + `${String(oldField1.type)} to ${String(newField1.type)}.`
            });
        }
    }
    return schemaChanges;
}
function findUnionTypeChanges(oldType, newType) {
    const schemaChanges = [];
    const possibleTypesDiff = diff(oldType.getTypes(), newType.getTypes());
    for (const newPossibleType of possibleTypesDiff.added){
        schemaChanges.push({
            type: DangerousChangeType.TYPE_ADDED_TO_UNION,
            description: `${newPossibleType.name} was added to union type ${oldType.name}.`
        });
    }
    for (const oldPossibleType of possibleTypesDiff.removed){
        schemaChanges.push({
            type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
            description: `${oldPossibleType.name} was removed from union type ${oldType.name}.`
        });
    }
    return schemaChanges;
}
function findEnumTypeChanges(oldType, newType) {
    const schemaChanges = [];
    const valuesDiff = diff(oldType.getValues(), newType.getValues());
    for (const newValue of valuesDiff.added){
        schemaChanges.push({
            type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
            description: `${newValue.name} was added to enum type ${oldType.name}.`
        });
    }
    for (const oldValue of valuesDiff.removed){
        schemaChanges.push({
            type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
            description: `${oldValue.name} was removed from enum type ${oldType.name}.`
        });
    }
    return schemaChanges;
}
function findImplementedInterfacesChanges(oldType, newType) {
    const schemaChanges = [];
    const interfacesDiff = diff(oldType.getInterfaces(), newType.getInterfaces());
    for (const newInterface of interfacesDiff.added){
        schemaChanges.push({
            type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
            description: `${newInterface.name} added to interfaces implemented by ${oldType.name}.`
        });
    }
    for (const oldInterface of interfacesDiff.removed){
        schemaChanges.push({
            type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
            description: `${oldType.name} no longer implements interface ${oldInterface.name}.`
        });
    }
    return schemaChanges;
}
function findFieldChanges(oldType, newType) {
    const schemaChanges = [];
    const fieldsDiff = diff(objectValues(oldType.getFields()), objectValues(newType.getFields()));
    for (const oldField of fieldsDiff.removed){
        schemaChanges.push({
            type: BreakingChangeType.FIELD_REMOVED,
            description: `${oldType.name}.${oldField.name} was removed.`
        });
    }
    for (const [oldField1, newField] of fieldsDiff.persisted){
        schemaChanges.push(...findArgChanges(oldType, oldField1, newField));
        const isSafe = isChangeSafeForObjectOrInterfaceField(oldField1.type, newField.type);
        if (!isSafe) {
            schemaChanges.push({
                type: BreakingChangeType.FIELD_CHANGED_KIND,
                description: `${oldType.name}.${oldField1.name} changed type from ` + `${String(oldField1.type)} to ${String(newField.type)}.`
            });
        }
    }
    return schemaChanges;
}
function findArgChanges(oldType, oldField, newField) {
    const schemaChanges = [];
    const argsDiff = diff(oldField.args, newField.args);
    for (const oldArg of argsDiff.removed){
        schemaChanges.push({
            type: BreakingChangeType.ARG_REMOVED,
            description: `${oldType.name}.${oldField.name} arg ${oldArg.name} was removed.`
        });
    }
    for (const [oldArg1, newArg] of argsDiff.persisted){
        const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldArg1.type, newArg.type);
        if (!isSafe) {
            schemaChanges.push({
                type: BreakingChangeType.ARG_CHANGED_KIND,
                description: `${oldType.name}.${oldField.name} arg ${oldArg1.name} has changed type from ` + `${String(oldArg1.type)} to ${String(newArg.type)}.`
            });
        } else if (oldArg1.defaultValue !== undefined) {
            if (newArg.defaultValue === undefined) {
                schemaChanges.push({
                    type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                    description: `${oldType.name}.${oldField.name} arg ${oldArg1.name} defaultValue was removed.`
                });
            } else {
                const oldValueStr = stringifyValue(oldArg1.defaultValue, oldArg1.type);
                const newValueStr = stringifyValue(newArg.defaultValue, newArg.type);
                if (oldValueStr !== newValueStr) {
                    schemaChanges.push({
                        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                        description: `${oldType.name}.${oldField.name} arg ${oldArg1.name} has changed defaultValue from ${oldValueStr} to ${newValueStr}.`
                    });
                }
            }
        }
    }
    for (const newArg1 of argsDiff.added){
        if (isRequiredArgument(newArg1)) {
            schemaChanges.push({
                type: BreakingChangeType.REQUIRED_ARG_ADDED,
                description: `A required arg ${newArg1.name} on ${oldType.name}.${oldField.name} was added.`
            });
        } else {
            schemaChanges.push({
                type: DangerousChangeType.OPTIONAL_ARG_ADDED,
                description: `An optional arg ${newArg1.name} on ${oldType.name}.${oldField.name} was added.`
            });
        }
    }
    return schemaChanges;
}
function isChangeSafeForObjectOrInterfaceField(oldType, newType) {
    if (isListType(oldType)) {
        return isListType(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType) || isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType);
    }
    if (isNonNullType(oldType)) {
        return isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType);
    }
    return isNamedType(newType) && oldType.name === newType.name || isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType);
}
function isChangeSafeForInputObjectFieldOrFieldArg(oldType, newType) {
    if (isListType(oldType)) {
        return isListType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType);
    }
    if (isNonNullType(oldType)) {
        return isNonNullType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType) || !isNonNullType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType);
    }
    return isNamedType(newType) && oldType.name === newType.name;
}
function typeKindName(type) {
    if (isScalarType(type)) {
        return 'a Scalar type';
    }
    if (isObjectType(type)) {
        return 'an Object type';
    }
    if (isInterfaceType(type)) {
        return 'an Interface type';
    }
    if (isUnionType(type)) {
        return 'a Union type';
    }
    if (isEnumType(type)) {
        return 'an Enum type';
    }
    if (isInputObjectType(type)) {
        return 'an Input type';
    }
    invariant(false, 'Unexpected type: ' + inspect(type));
}
function stringifyValue(value, type) {
    const ast = astFromValue(value, type);
    invariant(ast != null);
    const sortedAST = visit(ast, {
        ObjectValue (objectNode) {
            const fields = [
                ...objectNode.fields
            ].sort((fieldA, fieldB)=>fieldA.name.value.localeCompare(fieldB.name.value));
            return {
                ...objectNode,
                fields
            };
        }
    });
    return print(sortedAST);
}
function diff(oldArray, newArray) {
    const added = [];
    const removed = [];
    const persisted = [];
    const oldMap = keyMap(oldArray, ({ name  })=>name);
    const newMap = keyMap(newArray, ({ name  })=>name);
    for (const oldItem of oldArray){
        const newItem = newMap[oldItem.name];
        if (newItem === undefined) {
            removed.push(oldItem);
        } else {
            persisted.push([
                oldItem,
                newItem
            ]);
        }
    }
    for (const newItem1 of newArray){
        if (oldMap[newItem1.name] === undefined) {
            added.push(newItem1);
        }
    }
    return {
        added,
        persisted,
        removed
    };
}
function findDeprecatedUsages(schema, ast) {
    const errors = [];
    const typeInfo = new TypeInfo(schema);
    visit(ast, visitWithTypeInfo(typeInfo, {
        Field (node) {
            const parentType = typeInfo.getParentType();
            const fieldDef = typeInfo.getFieldDef();
            if (parentType && fieldDef?.deprecationReason != null) {
                errors.push(new GraphQLError(`The field "${parentType.name}.${fieldDef.name}" is deprecated. ` + fieldDef.deprecationReason, node));
            }
        },
        EnumValue (node) {
            const type = getNamedType(typeInfo.getInputType());
            const enumVal = typeInfo.getEnumValue();
            if (type && enumVal?.deprecationReason != null) {
                errors.push(new GraphQLError(`The enum value "${type.name}.${enumVal.name}" is deprecated. ` + enumVal.deprecationReason, node));
            }
        }
    }));
    return errors;
}
const mod3 = {
    version: version,
    versionInfo: versionInfo,
    graphql: graphql,
    graphqlSync: graphqlSync,
    GraphQLSchema: GraphQLSchema,
    GraphQLDirective: GraphQLDirective,
    GraphQLScalarType: GraphQLScalarType,
    GraphQLObjectType: GraphQLObjectType,
    GraphQLInterfaceType: GraphQLInterfaceType,
    GraphQLUnionType: GraphQLUnionType,
    GraphQLEnumType: GraphQLEnumType,
    GraphQLInputObjectType: GraphQLInputObjectType,
    GraphQLList: GraphQLList,
    GraphQLNonNull: GraphQLNonNull,
    specifiedScalarTypes: specifiedScalarTypes,
    GraphQLInt: GraphQLInt,
    GraphQLFloat: GraphQLFloat,
    GraphQLString: GraphQLString,
    GraphQLBoolean: GraphQLBoolean,
    GraphQLID: GraphQLID,
    specifiedDirectives: specifiedDirectives,
    GraphQLIncludeDirective: GraphQLIncludeDirective,
    GraphQLSkipDirective: GraphQLSkipDirective,
    GraphQLDeprecatedDirective: GraphQLDeprecatedDirective,
    TypeKind: TypeKind,
    DEFAULT_DEPRECATION_REASON: DEFAULT_DEPRECATION_REASON,
    introspectionTypes: introspectionTypes,
    __Schema: __Schema,
    __Directive: __Directive,
    __DirectiveLocation: __DirectiveLocation,
    __Type: __Type,
    __Field: __Field,
    __InputValue: __InputValue,
    __EnumValue: __EnumValue,
    __TypeKind: __TypeKind,
    SchemaMetaFieldDef: SchemaMetaFieldDef,
    TypeMetaFieldDef: TypeMetaFieldDef,
    TypeNameMetaFieldDef: TypeNameMetaFieldDef,
    isSchema: isSchema,
    isDirective: isDirective,
    isType: isType,
    isScalarType: isScalarType,
    isObjectType: isObjectType,
    isInterfaceType: isInterfaceType,
    isUnionType: isUnionType,
    isEnumType: isEnumType,
    isInputObjectType: isInputObjectType,
    isListType: isListType,
    isNonNullType: isNonNullType,
    isInputType: isInputType,
    isOutputType: isOutputType,
    isLeafType: isLeafType,
    isCompositeType: isCompositeType,
    isAbstractType: isAbstractType,
    isWrappingType: isWrappingType,
    isNullableType: isNullableType,
    isNamedType: isNamedType,
    isRequiredArgument: isRequiredArgument,
    isRequiredInputField: isRequiredInputField,
    isSpecifiedScalarType: isSpecifiedScalarType,
    isIntrospectionType: isIntrospectionType,
    isSpecifiedDirective: isSpecifiedDirective,
    assertSchema: assertSchema,
    assertDirective: assertDirective,
    assertType: assertType,
    assertScalarType: assertScalarType,
    assertObjectType: assertObjectType,
    assertInterfaceType: assertInterfaceType,
    assertUnionType: assertUnionType,
    assertEnumType: assertEnumType,
    assertInputObjectType: assertInputObjectType,
    assertListType: assertListType,
    assertNonNullType: assertNonNullType,
    assertInputType: assertInputType,
    assertOutputType: assertOutputType,
    assertLeafType: assertLeafType,
    assertCompositeType: assertCompositeType,
    assertAbstractType: assertAbstractType,
    assertWrappingType: assertWrappingType,
    assertNullableType: assertNullableType,
    assertNamedType: assertNamedType,
    getNullableType: getNullableType,
    getNamedType: getNamedType,
    validateSchema: validateSchema,
    assertValidSchema: assertValidSchema,
    Source: Source,
    getLocation: getLocation,
    printLocation: printLocation,
    printSourceLocation: printSourceLocation,
    Lexer: Lexer,
    TokenKind: TokenKind,
    parse: parse4,
    parseValue: parseValue,
    parseType: parseType,
    print: print,
    visit: visit,
    visitInParallel: visitInParallel,
    getVisitFn: getVisitFn,
    BREAK: BREAK,
    Kind: Kind,
    DirectiveLocation: DirectiveLocation,
    isDefinitionNode: isDefinitionNode,
    isExecutableDefinitionNode: isExecutableDefinitionNode,
    isSelectionNode: isSelectionNode,
    isValueNode: isValueNode,
    isTypeNode: isTypeNode,
    isTypeSystemDefinitionNode: isTypeSystemDefinitionNode,
    isTypeDefinitionNode: isTypeDefinitionNode,
    isTypeSystemExtensionNode: isTypeSystemExtensionNode,
    isTypeExtensionNode: isTypeExtensionNode,
    execute: execute,
    defaultFieldResolver: defaultFieldResolver,
    defaultTypeResolver: defaultTypeResolver,
    responsePathAsArray: pathToArray,
    getDirectiveValues: getDirectiveValues,
    subscribe: subscribe,
    createSourceEventStream: createSourceEventStream,
    validate: validate,
    ValidationContext: ValidationContext,
    specifiedRules: specifiedRules,
    ExecutableDefinitionsRule: ExecutableDefinitionsRule,
    FieldsOnCorrectTypeRule: FieldsOnCorrectTypeRule,
    FragmentsOnCompositeTypesRule: FragmentsOnCompositeTypesRule,
    KnownArgumentNamesRule: KnownArgumentNamesRule,
    KnownDirectivesRule: KnownDirectivesRule,
    KnownFragmentNamesRule: KnownFragmentNamesRule,
    KnownTypeNamesRule: KnownTypeNamesRule,
    LoneAnonymousOperationRule: LoneAnonymousOperationRule,
    NoFragmentCyclesRule: NoFragmentCyclesRule,
    NoUndefinedVariablesRule: NoUndefinedVariablesRule,
    NoUnusedFragmentsRule: NoUnusedFragmentsRule,
    NoUnusedVariablesRule: NoUnusedVariablesRule,
    OverlappingFieldsCanBeMergedRule: OverlappingFieldsCanBeMergedRule,
    PossibleFragmentSpreadsRule: PossibleFragmentSpreadsRule,
    ProvidedRequiredArgumentsRule: ProvidedRequiredArgumentsRule,
    ScalarLeafsRule: ScalarLeafsRule,
    SingleFieldSubscriptionsRule: SingleFieldSubscriptionsRule,
    UniqueArgumentNamesRule: UniqueArgumentNamesRule,
    UniqueDirectivesPerLocationRule: UniqueDirectivesPerLocationRule,
    UniqueFragmentNamesRule: UniqueFragmentNamesRule,
    UniqueInputFieldNamesRule: UniqueInputFieldNamesRule,
    UniqueOperationNamesRule: UniqueOperationNamesRule,
    UniqueVariableNamesRule: UniqueVariableNamesRule,
    ValuesOfCorrectTypeRule: ValuesOfCorrectTypeRule,
    VariablesAreInputTypesRule: VariablesAreInputTypesRule,
    VariablesInAllowedPositionRule: VariablesInAllowedPositionRule,
    LoneSchemaDefinitionRule: LoneSchemaDefinitionRule,
    UniqueOperationTypesRule: UniqueOperationTypesRule,
    UniqueTypeNamesRule: UniqueTypeNamesRule,
    UniqueEnumValueNamesRule: UniqueEnumValueNamesRule,
    UniqueFieldDefinitionNamesRule: UniqueFieldDefinitionNamesRule,
    UniqueDirectiveNamesRule: UniqueDirectiveNamesRule,
    PossibleTypeExtensionsRule: PossibleTypeExtensionsRule,
    GraphQLError: GraphQLError,
    syntaxError: syntaxError,
    locatedError: locatedError,
    printError: printError,
    formatError: formatError,
    getIntrospectionQuery: getIntrospectionQuery,
    getOperationAST: getOperationAST,
    getOperationRootType: getOperationRootType,
    introspectionFromSchema: introspectionFromSchema,
    buildClientSchema: buildClientSchema,
    buildASTSchema: buildASTSchema,
    buildSchema: buildSchema,
    getDescription: getDescription,
    extendSchema: extendSchema,
    lexicographicSortSchema: lexicographicSortSchema,
    printSchema: printSchema,
    printType: printType,
    printIntrospectionSchema: printIntrospectionSchema,
    typeFromAST: typeFromAST,
    valueFromAST: valueFromAST,
    valueFromASTUntyped: valueFromASTUntyped,
    astFromValue: astFromValue,
    TypeInfo: TypeInfo,
    visitWithTypeInfo: visitWithTypeInfo,
    coerceInputValue: coerceInputValue,
    concatAST: concatAST,
    separateOperations: separateOperations,
    isEqualType: isEqualType,
    isTypeSubTypeOf: isTypeSubTypeOf,
    doTypesOverlap: doTypesOverlap,
    assertValidName: assertValidName,
    isValidNameError: isValidNameError,
    BreakingChangeType: BreakingChangeType,
    DangerousChangeType: DangerousChangeType,
    findBreakingChanges: findBreakingChanges,
    findDangerousChanges: findDangerousChanges,
    findDeprecatedUsages: findDeprecatedUsages
};
const typeDefs = `
  type Query {
    me: User
  }

  type User {
    username: String!
  }
`;
const rootValue = {
    me: ()=>{
        return {
            username: 'Jan Van Riel'
        };
    }
};
const epsilonHandler = async (view, source)=>{
    try {
        const schema = mod3.buildSchema(typeDefs);
        const result = await mod3.graphql(schema, source, rootValue);
        console.log('RESULT', result);
        return result;
    } catch (err) {
        return {
            errors: [
                {
                    message: `${err}`
                }
            ]
        };
    }
};
const epsilon = async (event, init)=>{
    try {
        const project = new mod.Project(event.project.apiKey);
        const view = new mod.View(event.view.qid);
        view._setConfig({
            project: project
        });
        if (init) {
            if (init.testing === true) {
                mod.setHost('https://twintag.io');
                mod.setAdminHost('https://admin.twintag.io');
            }
        }
        mod.setLogLevel(event.logging.http);
        if (event.logging.event === 'request' || event.logging.event === 'request+response') {
            console.log('Event.request', event.request.body);
        }
        const response = await epsilonHandler(view, event.request.body);
        if (event.logging.event === 'response' || event.logging.event === 'request+response') {
            console.log('Event.response', response);
        }
        return new Response(JSON.stringify(response));
    } catch (e) {
        console.error(e);
        return new Response('Failed ' + e);
    }
};
const root = typeof globalThis !== 'undefined' ? globalThis : window;
root.epsilon = epsilon;
export { root as root };
export { epsilon as epsilon };

