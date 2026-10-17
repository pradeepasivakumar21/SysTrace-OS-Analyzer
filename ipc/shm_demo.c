
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <string.h>

int main() {
    const char *name = "/sysTraceSharedMemory";
    int fd = shm_open(name, O_CREAT | O_RDWR, 0666);

    if (fd == -1) {
        perror("shm_open");
        return 1;
    }

    ftruncate(fd, 1024);

    char *ptr = mmap(NULL, 1024, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);

    if (ptr == MAP_FAILED) {
        perror("mmap");
        close(fd);
        shm_unlink(name);
        return 1;
    }

    pid_t pid = fork();

    if (pid == -1) {
        perror("fork");
        munmap(ptr, 1024);
        close(fd);
        shm_unlink(name);
        return 1;
    }

    if (pid == 0) {
        sleep(1);
        printf("Child received: %s\n", ptr);
    } else {
        strcpy(ptr, "Hello through shared memory");
        printf("Parent wrote message to shared memory\n");
        wait(NULL);
    }

    munmap(ptr, 1024);
    close(fd);
    shm_unlink(name);

    return 0;
}

