#include <iostream>
#include <stdint.h>
#include "keccak-tiny.h"
#include <vector>
#include <string>
#include <atomic>
#include <pthread.h>

void doHashes(uint8_t *in_dta, uint8_t *out_dta, int num) {
    for (int i = 0; i < num; i++) {
        keccak::sha3_256(out_dta, 32, in_dta, 64);
        out_dta += 32;
        in_dta += 64;
    }
}

void doHashes16(uint8_t *in_dta, uint8_t *out_dta, int num) {
    for (int i = 0; i < num; i++) {
        keccak::sha3_256(out_dta, 32, in_dta, 32);
        out_dta += 32;
        in_dta += 32;
    }
}

struct Info {
    uint8_t *in_dta;
    uint8_t *out_dta;
    int num;
    std::atomic_int *waiting;
    pthread_cond_t *cond;
    pthread_mutex_t *mut;
    Info(uint8_t *in_dta_, uint8_t *out_dta_, int num_, std::atomic_int *waiting_, pthread_cond_t *cond_, pthread_mutex_t *mut_) {
        in_dta = in_dta_;
        out_dta = out_dta_;
        num = num_;
        waiting = waiting_;
        cond = cond_;
        mut = mut_;
    }
};

void *task(void *dta) {
    Info *i = (Info *)dta;
    doHashes(i->in_dta, i->out_dta, i->num);
    pthread_mutex_lock(i->mut);
    (*i->waiting)++;
    pthread_mutex_unlock(i->mut);
    pthread_cond_signal(i->cond);
    // std::cerr << "Waiting " << (*i->waiting) << std::endl;
    return NULL;
}

void *task16(void *dta) {
    Info *i = (Info *)dta;
    doHashes16(i->in_dta, i->out_dta, i->num);
    pthread_mutex_lock(i->mut);
    (*i->waiting)++;
    pthread_mutex_unlock(i->mut);
    pthread_cond_signal(i->cond);
    // std::cerr << "Waiting " << (*i->waiting) << std::endl;
    return NULL;
}

std::string hex(uint8_t *a) {
    static char const* hexdigits = "0123456789abcdef";
    std::string hex(64, '0');
    int off = 0;
    for (int i = 0; i < 32; i++) {
        hex[off++] = hexdigits[(a[i] >> 4) & 0x0f];
        hex[off++] = hexdigits[a[i] & 0x0f];
    }
    return hex;
}

int calc(int num) {
    if (num == 0) return 0;
    else return 1 + calc(num/2);
}

void handle16(uint8_t *in_dta, uint8_t *out_dta, int len) {
    int num = len / 32;
    // std::cerr << "First hash " << num << std::endl;

    if (num > 1000000) {
        int n_threads = 8;
        int size = num/n_threads;

        std::atomic_int *waiting = new std::atomic_int;
        *waiting = 0;

        pthread_mutex_t mut;
        pthread_mutex_init(&mut, NULL);

        pthread_cond_t cond;
        pthread_cond_init(&cond, NULL);

        for (int i = 0; i < n_threads; i++) {
            pthread_t *thr = new pthread_t;
            Info *dta = new Info(in_dta+i*size*32, out_dta+i*size*32, size, waiting, &cond, &mut);
            pthread_create(thr, NULL, &task16, (void*)dta);
        }

        pthread_mutex_lock(&mut);
        while (*waiting < n_threads) {
            pthread_cond_wait(&cond, &mut);
        }
        pthread_mutex_unlock(&mut);
    }
    else doHashes16(in_dta, out_dta, num);
}

extern "C" uint8_t *makeProof(int len, uint8_t *dta, int ptr, int mode) {
    uint8_t *data1 = dta;
    uint8_t *data2 = (uint8_t*)malloc(len);
    uint8_t *to_free = data2;

    if (mode == 1) {
        handle16(dta, data2, len);
        data1 = data2;
        data2 = dta;
    }

    uint8_t *in_dta, *out_dta;
    int num = len / 64;
    int turn = 0;
    
    uint8_t *proof = (uint8_t*)malloc(calc(len/32) * 32);
    // std::cerr << "Proof length " << (calc(len/32)) << std::endl;

    uint8_t *proof_ptr = proof;
    
    out_dta = data1;

    while (num > 0) {
        // std::cerr << "Looping " << num << std::endl;
        in_dta = turn%2 == 0 ? data1 : data2;
        out_dta = turn%2 == 0 ? data2 : data1;
        
        int other = ptr%2 == 0 ? ptr+1 : ptr-1;
        memcpy(proof_ptr, in_dta+other*32, 32);
        // std::cerr << "Elem: " << hex(proof_ptr) << " at " << other << std::endl;
        proof_ptr += 32;
        
        turn++;
        
        if (num > 1000000) {
            int n_threads = 8;
            int size = num/n_threads;
            
            std::atomic_int *waiting = new std::atomic_int;
            *waiting = 0;
            
            pthread_mutex_t mut;
            pthread_mutex_init(&mut, NULL);
            
            pthread_cond_t cond;
            pthread_cond_init(&cond, NULL);
            
            for (int i = 0; i < n_threads; i++) {
                pthread_t *thr = new pthread_t;
                Info *dta = new Info(in_dta+i*size*64, out_dta+i*size*32, size, waiting, &cond, &mut);
                pthread_create(thr, NULL, &task, (void*)dta);
            }
            
            pthread_mutex_lock(&mut);
            while (*waiting < n_threads) {
                pthread_cond_wait(&cond, &mut);
            }
            pthread_mutex_unlock(&mut);
        }
        else doHashes(in_dta, out_dta, num);
        
        num = num/2;
        ptr = ptr/2;
    }

    memcpy(proof_ptr, out_dta, 32);
    // std::cerr << "Elem: " << hex(proof_ptr) << " at " << ptr << std::endl;
    proof_ptr += 32;
    
    free(to_free);
    
    return proof;
}

int main(int argc, char **argv) {
    if (argc < 3) {
        std::cerr << "Arguments: size of input, index of 32 byte element for which to generate proof" << std::endl;
        return 1;
    }
    int len = std::stoi(std::string(argv[1]));
    int ptr = std::stoi(std::string(argv[2]));
    // std::vector<uint8_t> data1(len);
    // std::vector<uint8_t> data2(len);
    char *dta = (char*)malloc(len);
    for (int i = 0; i < len/1024; i++) {
        std::cin.read(dta+i*1024, 1024);
    }
    
    makeProof(len, (uint8_t*)dta, ptr, 0);
    return 0;
}

