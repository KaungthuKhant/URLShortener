import {urlExist} from "url-exist";


async function checkURLExists(full) {
    // check to make sure fullUrl exists
    const exists = await urlExist(full);
    return exists
}

export default checkURLExists;